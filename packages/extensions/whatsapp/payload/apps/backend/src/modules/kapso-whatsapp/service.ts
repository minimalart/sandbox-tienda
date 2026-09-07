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
import { getKapsoSettings } from './settings';
import { whatsappTemplates, type WhatsappTemplatePayload } from './templates';

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
 */
class KapsoWhatsappProviderService extends AbstractNotificationProviderService {
  static identifier = 'kapso-whatsapp';

  private options: KapsoProviderOptions;
  private logger: Logger;
  private client?: KapsoClient;
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

    if (options.api_key && options.phone_number_id) {
      this.client = new KapsoClient({
        apiKey: options.api_key,
        baseUrl: options.base_url,
      });
      this.logger.info('[kapso-whatsapp] WhatsApp provider initialized with Kapso');
    } else {
      this.logger.warn(
        '[kapso-whatsapp] No KAPSO_API_KEY/phone_number_id configured, WhatsApp messages will be logged only',
      );
    }
  }

  // Sin validateOptions a propósito: el provider se registra siempre. Cuando
  // faltan credenciales cae a modo log (ver constructor + send), de modo que el
  // canal `whatsapp` nunca rompe el arranque del backend.

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
   */
  private async clientForSite(
    siteId: string | undefined,
    salesChannelId?: string | undefined,
  ): Promise<KapsoClient | undefined> {
    if ((!siteId && !salesChannelId) || !this.pgConnection) return this.client;

    try {
      const { resolveSiteViaSql } = await import('../../lib/multistore/resolve-site-sql.js');
      const { readSiteCredentialsViaSql } = await import('../../lib/multistore/credentials.js');

      // `siteId` gana: es explícito. El canal es la derivación, y resuelve también
      // por el canal MAYORISTA de una tienda B2B.
      const site = await resolveSiteViaSql(this.pgConnection, { siteId, salesChannelId });
      const creds = await readSiteCredentialsViaSql<{ apiKey?: string; baseUrl?: string }>(
        this.pgConnection,
        'kapso',
        site,
      );

      if (creds.status === 'missing' && creds.reason === 'undecryptable') {
        throw new Error(
          '[kapso-whatsapp] Las credenciales de esta tienda no se pueden descifrar. ' +
            'No se manda el mensaje para no usar el número de otra tienda.',
        );
      }
      if (creds.status !== 'found' || creds.source !== 'site' || !creds.value.apiKey) {
        return this.client;
      }

      return new KapsoClient({
        apiKey: creds.value.apiKey,
        baseUrl: creds.value.baseUrl ?? this.options.base_url,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('no se pueden descifrar')) throw error;
      this.logger.warn(
        `[kapso-whatsapp] No se pudieron resolver las credenciales por tienda: ${
          error instanceof Error ? error.message : String(error)
        }. Se usa el número de entorno.`,
      );
      return this.client;
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
  ): Promise<WhatsappTemplatePayload | null> {
    // Una sola lectura de configuración por resolución: la comparten el fallback
    // de idioma y el builder, así que no puede pasar que el nombre de la
    // plantilla salga de una versión y el idioma de otra.
    const settings = getKapsoSettings();

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

    const template = await this.resolveTemplate(notification.template as string, data);
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

    // El número de la tienda que origina el mensaje, si el emisor lo declaró.
    const client = await this.clientForSite(
      typeof data.site_id === 'string' ? data.site_id : undefined,
      typeof data.sales_channel_id === 'string' ? data.sales_channel_id : undefined,
    );

    if (!client || !this.options.phone_number_id) {
      this.logger.info(
        `[kapso-whatsapp][LOG] To: ${to}, template: ${template.name}, components: ${JSON.stringify(
          template.components ?? [],
        )}`,
      );
      return { id: `log-${Date.now()}` };
    }

    try {
      const { id } = await client.sendMessage(this.options.phone_number_id, payload);
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
