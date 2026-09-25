import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from '@medusajs/framework/types';
import {
  AbstractNotificationProviderService,
  ContainerRegistrationKeys,
} from '@medusajs/framework/utils';

import { KapsoClient } from './client';
import {
  credentialsFingerprint,
  loadKapsoSettingsViaPg,
  type KapsoSettings,
} from './settings';
import { whatsappTemplates, type WhatsappTemplatePayload } from './templates';
import { loadLazyModule, sourceSpecifier } from '../../lib/lazy-module';

/** Sólo tipos: `typeof import()` no emite y no entra al grafo de arranque. */
type ResolveSiteSql = typeof import('../../lib/multistore/resolve-site-sql.js');
type SiteCredentials = typeof import('../../lib/multistore/credentials.js');
type AbandonedCartDelivery = typeof import('./abandoned-cart-delivery.js');

export type KapsoProviderOptions = {
  api_key?: string;
  phone_number_id?: string;
  base_url?: string;
  // Cableados para uso futuro; el provider aún no los consume.
  business_account_id?: string;
  config_id?: string;
};

/** Binding evento → template de Kapso, tal como se guarda en store_setting. */
type TemplateBinding = {
  template_name: string;
  language?: string;
  params?: string[];
  status?: 'draft' | 'published';
};

/** Clave del setting que guarda el mapa { [eventKey]: TemplateBinding }. */
const BINDINGS_SETTING_KEY = 'whatsapp_template_bindings';

/**
 * Normaliza un teléfono al formato que espera Meta: solo dígitos, sin `+`, sin
 * espacios ni separadores. Devuelve null si no parece un número válido.
 */
function toMetaPhone(to: string | undefined | null): string | null {
  if (!to) return null;
  const digits = String(to).replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

/**
 * Notification provider del canal `whatsapp` sobre Kapso. Espejo del provider de
 * email: si no hay credenciales, loguea en vez de enviar (no rompe el flujo de
 * checkout). Solo envía templates aprobados por Meta.
 *
 * Resolución del template (mismo espíritu que email):
 *  1. Binding PUBLICADO en store_setting (asignado desde el admin) → arma los
 *     components mapeando `params` sobre los datos del evento.
 *  2. Fallback al mapa hardcodeado en ./templates.
 *
 * DE DÓNDE SALEN LAS CREDENCIALES, y por qué esto cambió:
 *
 * Antes salían SÓLO de `this.options`, o sea de `process.env` vía medusa-config.
 * Con la API key y el `phone_number_id` cargados desde el admin —que es el caso
 * normal desde que existe `app-settings`— el constructor no armaba cliente, `send`
 * caía en el modo LOG y Medusa daba el envío por exitoso: el mensaje no salía
 * nunca y no había un solo error en ningún lado. La trampa era doble, porque
 * `/admin/kapso/templates` SÍ lee la key de `app-settings`: el admin mostraba la
 * integración andando mientras el envío estaba muerto.
 *
 * Ahora la fuente es `loadKapsoSettingsViaPg`, el camino que `settings.ts`
 * documenta como "para el NOTIFICATION PROVIDER" —memoizado 30 s, por
 * `PG_CONNECTION`, que es de las seis claves que el cradle hermético de
 * `load-internal.js` re-exporta— y `this.options` queda como FALLBACK para las
 * instalaciones que siguen configurando por env. La precedencia es la misma que
 * en el resto de `app-settings`: base ?? env ?? default.
 */
class KapsoWhatsappProviderService extends AbstractNotificationProviderService {
  static identifier = 'kapso-whatsapp';

  private options: KapsoProviderOptions;
  private logger: Logger;
  /**
   * Cliente de la INSTANCIA, cacheado por huella de credenciales y no por tiempo:
   * `loadKapsoSettingsViaPg` ya memoiza la lectura, así que reconstruirlo en cada
   * envío sólo tiraría el keep-alive de axios. Se rearma solo cuando alguien
   * cambia la key en el admin, que es exactamente lo que mide la huella.
   */
  private instanceClientCache?: { fingerprint: string; client: KapsoClient };
  // Conexión Postgres compartida (knex), inyectada en el contenedor de cada
  // módulo. Deja leer los bindings desde store_setting sin resolver el módulo
  // (aislado) store-config — mismo patrón que el provider de email.
  private pgConnection?: {
    raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: any[] }>;
  };

  constructor(
    cradle: {
      logger: Logger;
      [ContainerRegistrationKeys.PG_CONNECTION]?: KapsoWhatsappProviderService['pgConnection'];
    },
    options: KapsoProviderOptions,
  ) {
    super();
    this.options = options;
    this.logger = cradle.logger;
    this.pgConnection = cradle[ContainerRegistrationKeys.PG_CONNECTION];
  }

  // Sin validateOptions a propósito: el provider se registra siempre. Cuando
  // faltan credenciales cae a modo log (ver `send`), de modo que el canal
  // `whatsapp` nunca rompe el arranque del backend.
  //
  // Y por eso el constructor tampoco decide nada ni loguea el estado de la
  // integración: las credenciales viven en la base y se leen al enviar. Un
  // "provider initialized"/"no configured" emitido al arrancar sólo podía
  // describir el env, y quedaba desmentido por el primer envío.

  /**
   * Credenciales efectivas de la INSTANCIA: primero lo configurado en el admin,
   * después el env. Devuelve `undefined` si no hay API key en ningún lado, que es
   * la única condición real de "no se puede enviar".
   */
  private instanceClient(settings: KapsoSettings): KapsoClient | undefined {
    const apiKey = settings.apiKey || this.options.api_key;
    if (!apiKey) return undefined;

    const baseUrl = settings.baseUrl || this.options.base_url;
    const fingerprint = credentialsFingerprint({ apiKey, baseUrl: baseUrl ?? '' });
    if (this.instanceClientCache?.fingerprint !== fingerprint) {
      this.instanceClientCache = {
        fingerprint,
        client: new KapsoClient({ apiKey, baseUrl }),
      };
    }
    return this.instanceClientCache.client;
  }

  /** El `phone_number_id` efectivo, con la misma precedencia: base ?? env. */
  private phoneNumberId(settings: KapsoSettings): string | undefined {
    return settings.phoneNumberId || this.options.phone_number_id || undefined;
  }

  /**
   * El cliente con el número de WhatsApp de la tienda que origina el mensaje.
   *
   * Cuando se manda una notificación NO hay request, así que la tienda tiene que
   * VIAJAR en la `data`. Se aceptan DOS formas: `site_id` explícito, o
   * `sales_channel_id`, que es lo que los emisores de orden ya tienen a mano y no
   * les cuesta nada agregar al graph. Mientras un emisor no mande ninguna de las
   * dos, este provider usa el número de entorno, que es lo de siempre.
   *
   * Igual que en los carriers: si la tienda declaró credenciales propias y no se
   * pueden descifrar, se corta en vez de mandar desde el número de otra tienda —
   * un WhatsApp sale una sola vez y no se puede deshacer.
   *
   * LA API KEY Y EL `phone_number_id` SON UNA SOLA CREDENCIAL, NO DOS CAMPOS.
   *
   * Cada API key de Kapso da acceso a UNA configuración de WhatsApp. Esto antes
   * devolvía sólo el cliente y el `phone_number_id` se leía aparte de los ajustes
   * de la INSTANCIA, así que una tienda con key propia mandaba `key de la tienda +
   * número de la instancia`. Kapso contesta 401 `Invalid credentials for WhatsApp
   * configuration` —la key es válida, pero no sobre ESE número— y la orden se
   * confirma igual: el cliente nunca recibe la confirmación y el único rastro es
   * una línea de error en el backend.
   *
   * Por eso devuelve el PAR. Media credencial de la tienda NO se completa con la
   * otra mitad de la instancia: o van los dos de la tienda, o los dos de la
   * instancia.
   */
  private async credentialsForSite(
    settings: KapsoSettings,
    siteId: string | undefined,
    salesChannelId?: string | undefined,
  ): Promise<{ client: KapsoClient; phoneNumberId: string } | undefined> {
    /** El par de la instancia, entero. Nunca una mitad. */
    const instancePair = (): { client: KapsoClient; phoneNumberId: string } | undefined => {
      const client = this.instanceClient(settings);
      const phoneNumberId = this.phoneNumberId(settings);
      return client && phoneNumberId ? { client, phoneNumberId } : undefined;
    };

    if ((!siteId && !salesChannelId) || !this.pgConnection) return instancePair();

    try {
      // Diferidos con `loadLazyModule` y NO con `await import('….js')`: ese
      // especificador no resuelve en producción (ver `lib/lazy-module.ts`), y acá
      // el catch de abajo lo habría tapado como "no se pudo resolver la tienda".
      const { resolveSiteViaSql } = await loadLazyModule<ResolveSiteSql>(
        'el resolutor de tienda por SQL',
        () => require('../../lib/multistore/resolve-site-sql'),
        () => import(sourceSpecifier('../../lib/multistore/resolve-site-sql')),
      );
      const { readSiteCredentialsViaSql } = await loadLazyModule<SiteCredentials>(
        'el lector de credenciales por tienda',
        () => require('../../lib/multistore/credentials'),
        () => import(sourceSpecifier('../../lib/multistore/credentials')),
      );

      // `siteId` gana: es explícito. El canal es la derivación, y resuelve también
      // por el canal MAYORISTA de una tienda B2B.
      const site = await resolveSiteViaSql(this.pgConnection, { siteId, salesChannelId });
      const creds = await readSiteCredentialsViaSql<{
        apiKey?: string;
        baseUrl?: string;
        phoneNumberId?: string;
      }>(this.pgConnection, 'kapso', site);

      if (creds.status === 'missing' && creds.reason === 'undecryptable') {
        throw new Error(
          '[kapso-whatsapp] Las credenciales de esta tienda no se pueden descifrar. ' +
            'No se manda el mensaje para no usar el número de otra tienda.',
        );
      }
      if (creds.status !== 'found' || creds.source !== 'site' || !creds.value.apiKey) {
        return instancePair();
      }

      // Key propia SIN número propio es una credencial a medias. Completarla con
      // el número de la instancia es justo lo que produce el 401, así que se cae
      // al par de la instancia ENTERO y se dice por qué.
      if (!creds.value.phoneNumberId) {
        this.logger.warn(
          `[kapso-whatsapp] La tienda declaró API key propia pero no 'phoneNumberId'. ` +
            `Mezclarla con el número de la instancia da 401 (Invalid credentials for WhatsApp ` +
            `configuration), así que se usa el par completo de la instancia. Cargá el número en ` +
            `Ajustes → Credenciales por tienda → Kapso.`,
        );
        return instancePair();
      }

      return {
        client: new KapsoClient({
          apiKey: creds.value.apiKey,
          baseUrl: creds.value.baseUrl ?? this.options.base_url,
        }),
        phoneNumberId: creds.value.phoneNumberId,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('no se pueden descifrar')) throw error;
      this.logger.warn(
        `[kapso-whatsapp] No se pudieron resolver las credenciales por tienda: ${
          error instanceof Error ? error.message : String(error)
        }. Se usa el número de entorno.`,
      );
      return instancePair();
    }
  }

  /**
   * Lee el binding PUBLICADO para `key` desde store_setting. Devuelve null si no
   * hay conexión, no existe el setting, no hay binding para esa key, o su estado
   * no es 'published'. Cualquier error se loguea y devuelve null (nunca bloquea
   * el envío: se cae al fallback hardcodeado).
   */
  private async loadBinding(key: string): Promise<TemplateBinding | null> {
    if (!this.pgConnection) return null;
    try {
      const result = await this.pgConnection.raw(
        `SELECT "value" FROM "store_setting"
           WHERE "key" = ? AND "deleted_at" IS NULL
           LIMIT 1`,
        [BINDINGS_SETTING_KEY],
      );
      const rawValue = result?.rows?.[0]?.value;
      if (!rawValue) return null;
      const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
      const binding = (parsed as Record<string, TemplateBinding> | null)?.[key];
      if (!binding || binding.status !== 'published' || !binding.template_name) {
        return null;
      }
      return binding;
    } catch (error) {
      this.logger.warn(
        `[kapso-whatsapp] Lookup de binding falló para "${key}", uso fallback: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Resuelve el payload del template para un evento: primero el binding publicado
   * (config desde el admin), luego el mapa hardcodeado.
   */
  private async resolveTemplate(
    key: string,
    data: Record<string, unknown>,
    // Una sola lectura de configuración por ENVÍO, y entra por parámetro: la
    // comparten las credenciales, el fallback de idioma y el builder, así que no
    // puede pasar que el nombre de la plantilla salga de una versión y el idioma
    // —o el número que la manda— de otra.
    settings: KapsoSettings,
  ): Promise<WhatsappTemplatePayload | null> {
    const binding = await this.loadBinding(key);
    if (binding) {
      const parameters = (binding.params ?? []).map((field) => ({
        type: 'text',
        text: String(data[field] ?? ''),
      }));
      return {
        name: binding.template_name,
        // El fallback sale de la configuración, no de un `'es'` hardcodeado: una
        // cuenta que opera en es_AR o pt_BR mandaba un idioma que Meta rechaza,
        // y un binding sin idioma es el caso normal, no el raro.
        language: { code: binding.language || settings.templateLang },
        components: parameters.length ? [{ type: 'body', parameters }] : [],
      };
    }
    const builder = whatsappTemplates[key];
    return builder ? builder(data, settings) : null;
  }

  async send(
    notification: ProviderSendNotificationDTO,
  ): Promise<ProviderSendNotificationResultsDTO> {
    const data = (notification.data || {}) as Record<string, unknown>;

    const to = toMetaPhone(notification.to);
    if (!to) {
      this.logger.warn(
        `[kapso-whatsapp] Skipped: invalid/empty recipient phone ('${notification.to}')`,
      );
      return {};
    }

    if (/^cart-abandoned-[123]$/.test(String(notification.template)) && typeof data.cart_abandoned_template_name === 'string') {
      if (!this.pgConnection) throw new Error('WhatsApp store settings require a database connection');
      const { abandonedCartDelivery } = await loadLazyModule<AbandonedCartDelivery>(
        'el envío de carrito abandonado por WhatsApp',
        () => require('./abandoned-cart-delivery'),
        () => import(sourceSpecifier('./abandoned-cart-delivery')),
      );
      const delivery = await abandonedCartDelivery(this.pgConnection, data);
      const client = new KapsoClient({ apiKey: delivery.apiKey, baseUrl: delivery.baseUrl });
      const { id } = await client.sendMessage(delivery.phoneNumberId, { messaging_product: 'whatsapp', to, type: 'template', template: delivery.template });
      return { id };
    }

    // La configuración efectiva del envío. Va ANTES de resolver el template
    // porque las dos cosas —qué plantilla y con qué credenciales— salen de acá.
    const settings = await loadKapsoSettingsViaPg(this.pgConnection);

    const template = await this.resolveTemplate(notification.template as string, data, settings);
    if (!template) {
      this.logger.warn(
        `[kapso-whatsapp] No hay template (binding ni fallback) para '${notification.template}' — skipped`,
      );
      return {};
    }

    const payload = {
      messaging_product: 'whatsapp' as const,
      to,
      type: 'template',
      template,
    };

    // La credencial de la tienda que origina el mensaje, si el emisor la declaró.
    // Key y número vienen JUNTOS a propósito: ver `credentialsForSite`.
    const delivery = await this.credentialsForSite(
      settings,
      typeof data.site_id === 'string' ? data.site_id : undefined,
      typeof data.sales_channel_id === 'string' ? data.sales_channel_id : undefined,
    );

    if (!delivery) {
      // El modo LOG es una degradación legítima (un backend de desarrollo sin
      // cuenta de Kapso), pero para una instalación configurada es un mensaje que
      // el cliente nunca recibió. Decir CUÁL de las dos mitades falta es la
      // diferencia entre diagnosticarlo en un minuto y perseguirlo por Meta.
      const missing = [
        !this.instanceClient(settings) && 'API key',
        !this.phoneNumberId(settings) && 'phone_number_id',
      ]
        .filter(Boolean)
        .join(' y ');
      this.logger.warn(
        `[kapso-whatsapp][LOG] Sin ${missing}: el mensaje NO se envía. ` +
          `Cargalos en Admin → WhatsApp → Ajustes. ` +
          `To: ${to}, template: ${template.name}, components: ${JSON.stringify(
            template.components ?? [],
          )}`,
      );
      return { id: `log-${Date.now()}` };
    }

    const { client, phoneNumberId } = delivery;

    try {
      const { id } = await client.sendMessage(phoneNumberId, payload);
      this.logger.info(
        `[kapso-whatsapp] Sent template '${template.name}' to ${to} (id: ${id ?? 'n/a'})`,
      );
      return { id };
    } catch (error) {
      const response = (error as { response?: { data?: unknown } }).response;
      const detail = response?.data
        ? JSON.stringify(response.data)
        : (error as Error).message;
      this.logger.error(`[kapso-whatsapp] Failed to send to ${to}: ${detail}`);
      throw error;
    }
  }
}

export default KapsoWhatsappProviderService;
