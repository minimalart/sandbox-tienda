import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from '@medusajs/framework/types';
import {
  AbstractNotificationProviderService,
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import { MailService } from '@sendgrid/mail';
import { readForeignSetting } from '../app-settings/foreign';

import { renderEmailTemplate } from '../email-template/render';
import { EMAIL_BRANDING_DEFAULTS, type EmailBranding } from '../store-config/service';
import { hexToRgba } from './templates/email-helpers';
import { templates } from './templates';
import { resolveSiteViaSql } from '../../lib/multistore/resolve-site-sql';
import { pickTemplate, type PublishedTemplateRow } from './db-template-pick';
import { parseRecipientList } from '../../lib/recipient-list';

export type EmailProviderOptions = {
  from: string;
  sendgrid_api_key?: string;
};

// Reserved template key used by the admin "test send" endpoint to push an
// already-rendered subject/html through the email channel verbatim.
const INLINE_TEMPLATE_KEY = '__inline__';

/** Remitente tal como lo espera SendGrid: mail pelado o `{ email, name }`. */
export type EmailSender = string | { email: string; name: string };

/**
 * Remitente CON NOMBRE VISIBLE.
 *
 * `EMAIL_FROM` es un mail pelado (`info@tienda.com.ar`) en toda instalación que no
 * lo haya editado a mano, y SendGrid manda el `From:` sin display name. El cliente
 * de correo entonces muestra el local-part: en desdeelsur todos los mails llegaban
 * firmados **"info"**, no "Desde el sur". No es un problema de plantilla —el HTML
 * estaba perfecto— sino del sobre, que es lo único que el destinatario ve en la
 * bandeja antes de abrir.
 *
 * El nombre sale de `cde_display_name`, o sea del branding YA resuelto para la
 * tienda de este envío: el mismo eje que el logo, los colores y el footer. No hay
 * que configurar nada y en multitienda cada tienda firma con su propio nombre.
 *
 * Se devuelve `{ email, name }` en vez de armar `"Nombre <mail>"` a mano para que
 * el escaping RFC 5322 lo haga la librería: un nombre con coma o comillas
 * (`"Desde el sur, S.A."`) partido a mano produce un header inválido y SendGrid lo
 * rechaza con un 400 que no dice nada útil.
 *
 * `configured` ya trae nombre (`"Tienda <mail>"` o `{...}`) → se respeta tal cual:
 * quien lo escribió a mano sabe lo que quiso.
 */
export function senderWithDisplayName(
  configured: string,
  displayName: string | null | undefined
): EmailSender {
  const from = configured.trim();
  // Ya viene compuesto: hay `<...>`, o sea nombre + dirección. No tocar.
  if (from.includes('<')) return from;
  const name = displayName?.trim();
  if (!name) return from;
  return { email: from, name };
}

/** El remitente como texto, para los logs. `{email,name}` daría `[object Object]`. */
function senderForLog(sender: EmailSender): string {
  return typeof sender === 'string' ? sender : `${sender.name} <${sender.email}>`;
}

function resolveLogoForEmail(logoUrl: string | undefined): string | undefined {
  return logoUrl || undefined;
}

type Resolved = { subject: string; html: string; templateId?: string };

class EmailNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = 'email-provider';

  private options: EmailProviderOptions;
  private logger: Logger;

  // Shared Postgres connection (knex), injected into every module container as
  // `__pg_connection__`. Lets this provider read DB-authored templates without
  // resolving the (isolated) email_template module service.
  private pgConnection?: {
    raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: any[] }>;
  };

  /**
   * Cache de branding POR TIENDA. La clave importa: con un solo slot, el primer
   * mail de la tienda A dejaría su logo y sus colores cacheados un minuto, y todos
   * los mails de la tienda B en esa ventana saldrían con la marca de A. Es el modo
   * de falla más caro de este archivo porque el mail ya salió — no se puede deshacer.
   */
  private brandingCache = new Map<string, { value: EmailBranding; at: number }>();
  private static readonly BRANDING_TTL_MS = 60_000;
  /** Clave del cache para "sin tienda" (instalación mono-tienda o mail sin origen). */
  private static readonly GLOBAL_SITE_KEY = '__global__';

  /**
   * Cache de la tienda IMPLÍCITA. Ver `implicitSiteId`.
   *
   * Se cachea TAMBIÉN el `null` de una instalación multitienda, y eso es el punto: es
   * el valor que más se consulta —cada mail sin eje— y no puede costar una query.
   */
  private implicitSiteCache?: { value: string | null; at: number };
  private static readonly IMPLICIT_SITE_TTL_MS = 60_000;

  /**
   * Warns ya emitidos por (clave, tienda), para no floodear.
   *
   * `order.placed` puede emitir miles de mails por día: el warn de plantilla
   * inalcanzable tiene que ser una señal, no un muro que tape el resto del log.
   */
  private warnedOutOfScope = new Map<string, number>();
  private static readonly OUT_OF_SCOPE_WARN_TTL_MS = 300_000;

  /**
   * Claves que se descartaron por no tener plantilla, con el mismo throttling.
   *
   * Va en un mapa APARTE del de `warnedOutOfScope` y no comparte el TTL con él a
   * propósito: son dos diagnósticos distintos —"la plantilla existe y no se
   * alcanza" contra "la plantilla no existe en ningún lado"— y compartir el mapa
   * haría que uno silenciara al otro durante cinco minutos.
   */
  private warnedMissingTemplate = new Map<string, number>();
  private static readonly MISSING_TEMPLATE_WARN_TTL_MS = 300_000;

  constructor(
    cradle: {
      logger: Logger;
      [ContainerRegistrationKeys.PG_CONNECTION]?: EmailNotificationProviderService['pgConnection'];
    },
    options: EmailProviderOptions
  ) {
    super();
    this.options = options;
    this.logger = cradle.logger;
    this.pgConnection = cradle[ContainerRegistrationKeys.PG_CONNECTION];
  }

  static validateOptions(options: Record<string, unknown>) {
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option 'from' is required in the email provider options."
      );
    }
  }

  /**
   * Look up a published template by its `key` (which matches the `template`
   * string passed to createNotifications — an app notification key or a Medusa
   * event name). Returns null when no match is found or the query fails.
   */
  private async loadDbTemplate(
    key: string,
    siteId: string | null
  ): Promise<{ subject: string; html: string } | null> {
    if (!this.pgConnection) {
      return null;
    }
    try {
      /**
       * La plantilla de la tienda gana sobre la global; si no tiene, hereda.
       *
       * EL FILTRO DE TIENDA SALIÓ DEL `WHERE` A PROPÓSITO. Antes decía
       * `AND ("site_id" = ? OR "site_id" IS NULL)`, y con `siteId` en `null` eso
       * dejaba afuera TODA fila de tienda: en Postgres `"site_id" = NULL` no es falso,
       * es NULL, así que sólo entraban las globales. Resultado: para los ~10 emisores
       * cuyo evento no lleva ningún eje —el reseteo de contraseña el primero— una
       * plantilla publicada y scopeada a la tienda era inalcanzable, y el mail salía
       * con el texto del código sin una sola línea en el log.
       *
       * Ahora la consulta trae las candidatas y `pickTemplate` decide. Es la MISMA
       * consulta —una, `LIMIT` acotado, sobre el índice `(status, key)`— y a cambio el
       * caso "hay filas publicadas pero ninguna alcanzable" se puede DETECTAR, que es
       * lo que el `OR` hacía imposible: una fila fuera de scope y cero filas se veían
       * exactamente igual desde acá.
       *
       * El `ORDER BY` es lo que hace seguro el `LIMIT`: rango 0 es la fila de la
       * tienda, 1 la global, 2 las de otras tiendas. Las dos que pueden ganar ordenan
       * SIEMPRE primero, así que el límite nunca puede recortar la respuesta — sólo
       * recorta cuántas tiendas ajenas se pueden nombrar en el warn.
       *
       * `?::text` en vez de `?` a secas: `IS NOT DISTINCT FROM NULL` no le da a Postgres
       * de dónde inferir el tipo del parámetro. Y el `::` es seguro SÓLO porque los
       * bindings van como ARRAY: knex activa los bindings con nombre (`:algo`) cuando
       * recibe un objeto, y con un objeto leería `:text` como un binding faltante.
       */
      const result = await this.pgConnection.raw(
        `SELECT "subject", "html", "site_id" FROM "email_template"
           WHERE "key" = ?
             AND "status" = 'published'
             AND "deleted_at" IS NULL
           ORDER BY CASE
                      WHEN "site_id" IS NOT DISTINCT FROM ?::text THEN 0
                      WHEN "site_id" IS NULL THEN 1
                      ELSE 2
                    END,
                    "updated_at" DESC
           LIMIT 8`,
        [key, siteId]
      );
      const rows = (result?.rows ?? []) as PublishedTemplateRow[];
      const picked = pickTemplate(rows, siteId);

      if (picked.status === 'outOfScope') {
        this.warnTemplateOutOfScope(key, siteId, picked.siteIds);
        return null;
      }
      if (picked.status === 'none') {
        return null;
      }
      return { subject: picked.subject, html: picked.html };
    } catch (error) {
      this.logger.warn(
        `[email-provider] DB template lookup failed for "${key}", falling back to code: ${(error as Error).message}`
      );
      return null;
    }
  }

  /**
   * El rastro del modo de falla más silencioso del módulo: la plantilla EXISTE, está
   * publicada, y no se usa.
   *
   * Es la diferencia entre cinco minutos y una tarde. Sin esto el reporte es "edité la
   * plantilla, la publiqué, y sigue saliendo la de antes", y no hay nada en el log:
   * el único camino es leer el SQL de `loadDbTemplate` y cruzar el `site_id` de la
   * fila contra el `site_id` de la notificación a mano.
   *
   * NO cuesta una query extra. La fila fuera de scope viene en la MISMA consulta —el
   * `ORDER BY` la deja al final y el `LIMIT` la incluye—, así que el diagnóstico es un
   * subproducto de la lectura que ya se hacía.
   */
  private warnTemplateOutOfScope(key: string, siteId: string | null, rowSiteIds: string[]): void {
    const cacheKey = `${key}::${siteId ?? ''}`;
    const now = Date.now();
    const last = this.warnedOutOfScope.get(cacheKey);
    if (
      last !== undefined &&
      now - last < EmailNotificationProviderService.OUT_OF_SCOPE_WARN_TTL_MS
    ) {
      return;
    }
    this.warnedOutOfScope.set(cacheKey, now);

    const origen = siteId
      ? `la tienda "${siteId}"`
      : 'un mail SIN tienda (su emisor no declara `site_id` ni `sales_channel_id`)';
    this.logger.warn(
      `[email-provider] La plantilla "${key}" tiene filas PUBLICADAS pero ninguna alcanzable desde ` +
        `${origen}: las que hay son de [${rowSiteIds.join(', ')}] y no existe la versión global. ` +
        `El mail sale con el template del CÓDIGO. Se arregla de dos maneras: poniéndole ` +
        `site_id = null a una de esas plantillas (queda global y la hereda toda tienda sin la ` +
        `suya), o haciendo que el emisor declare su tienda en la data de la notificación ` +
        `(ver lib/multistore/job-scope.ts).`
    );
  }

  /**
   * Reads the `email_branding` setting directly from `store_setting` via the
   * shared knex connection (this provider can't resolve the store-config module
   * service — modules are isolated). Result is cached for `BRANDING_TTL_MS`.
   *
   * A broken/missing branding row must NEVER block an email: on ANY error we
   * warn and return the defaults.
   */
  private async loadBranding(siteId: string | null): Promise<EmailBranding> {
    const now = Date.now();
    const cacheKey = siteId ?? EmailNotificationProviderService.GLOBAL_SITE_KEY;
    const cached = this.brandingCache.get(cacheKey);
    if (cached && now - cached.at < EmailNotificationProviderService.BRANDING_TTL_MS) {
      return cached.value;
    }

    if (!this.pgConnection) {
      this.brandingCache.set(cacheKey, { value: EMAIL_BRANDING_DEFAULTS, at: now });
      return EMAIL_BRANDING_DEFAULTS;
    }

    try {
      const rawValue = await this.readBrandingRow(siteId);
      // The json column may come back as an object (parsed) or a string.
      const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
      const stored = (parsed && typeof parsed === 'object' ? parsed : {}) as Partial<EmailBranding>;
      const value: EmailBranding = {
        primary_color: stored.primary_color || EMAIL_BRANDING_DEFAULTS.primary_color,
        text_color: stored.text_color || EMAIL_BRANDING_DEFAULTS.text_color,
        logo_url: stored.logo_url ?? EMAIL_BRANDING_DEFAULTS.logo_url,
        cde_display_name: stored.cde_display_name ?? EMAIL_BRANDING_DEFAULTS.cde_display_name,
        admin_notification_email:
          stored.admin_notification_email ?? EMAIL_BRANDING_DEFAULTS.admin_notification_email,
      };
      this.brandingCache.set(cacheKey, { value, at: now });
      return value;
    } catch (error) {
      this.logger.warn(
        `[email-provider] Failed to load email branding, using defaults: ${(error as Error).message}`
      );
      this.brandingCache.set(cacheKey, { value: EMAIL_BRANDING_DEFAULTS, at: now });
      return EMAIL_BRANDING_DEFAULTS;
    }
  }

  /**
   * El branding crudo de una tienda, con precedencia tienda → global → legacy.
   *
   * Son tres fuentes y el orden es el punto:
   *  1. `site_setting` de ESA tienda — lo que el operador configuró para ella.
   *  2. `site_setting` global (`site_id IS NULL`) — el default de la instancia.
   *  3. `store_setting` — de antes de que existieran las tiendas. Sigue acá porque
   *     una instalación que nunca migró tiene su branding ahí y quedarse sin logo
   *     el día del deploy sería una regresión visible en cada mail.
   *
   * Una tabla ausente (`42P01`) no es un error: es una instalación sin la extensión
   * de tiendas. Se pasa a la fuente siguiente.
   */
  /**
   * El branding crudo de una tienda: el suyo si lo definió, el global si no.
   *
   * Es PRECEDENCIA, no unión, y las dos filas viven en la MISMA tabla — la que el
   * módulo store-config ya administra desde la pantalla de Preferencias. Leer de otra
   * tabla obligaría a escribir ahí por SQL crudo desde otro módulo, salteando el
   * upsert con revisión y los índices únicos parciales que arbitran las escrituras
   * concurrentes.
   */
  private async readBrandingRow(siteId: string | null): Promise<unknown> {
    const sources: Array<{ sql: string; bindings: unknown[] }> = [];
    if (siteId) {
      sources.push({
        sql: `SELECT "value" FROM "store_setting"
                WHERE "key" = 'email_branding' AND "site_id" = ? AND "deleted_at" IS NULL
                LIMIT 1`,
        bindings: [siteId],
      });
    }
    sources.push({
      sql: `SELECT "value" FROM "store_setting"
              WHERE "key" = 'email_branding' AND "site_id" IS NULL AND "deleted_at" IS NULL
              LIMIT 1`,
      bindings: [],
    });

    for (const source of sources) {
      const result = await this.pgConnection!.raw(source.sql, source.bindings);
      const value = result?.rows?.[0]?.value;
      if (value != null) return value;
    }
    return undefined;
  }

  /**
   * De qué tienda es este mail.
   *
   * No hay request acá —una notificación se emite desde un subscriber o un job—,
   * así que la tienda tiene que venir en la `data`. Se aceptan tres formas, de la
   * más explícita a la más derivada, porque hay ~30 emisores y migrarlos todos de
   * una es garantía de olvidarse de alguno.
   *
   * Sin ninguna de las tres, cae a `implicitSiteId()`: la única tienda de una
   * instalación mono-tienda, o `null` si hay varias.
   */
  private async siteIdForNotification(data: Record<string, unknown>): Promise<string | null> {
    const explicit = data.site_id;
    if (typeof explicit === 'string' && explicit) return explicit;

    const channelId = data.sales_channel_id;
    if (typeof channelId === 'string' && channelId && this.pgConnection) {
      try {
        // Por el resolvedor del seam, no con SQL propio: el nombre de la tabla vive en
        // `module-key.ts` y es el único literal del repo. Además esto arregla gratis
        // el caso B2B —el canal mayorista resuelve a su tienda— sin repetir el OR.
        const resolution = await resolveSiteViaSql(this.pgConnection, {
          salesChannelId: channelId,
        });
        if (resolution.status === 'site') return resolution.site.id;
        // Un canal que no pertenece a ninguna tienda (creado a mano) no es una tienda
        // distinta: es la misma ausencia de eje que no traer canal. Cae al implícito.
      } catch (error) {
        this.logger.warn(
          `[email-provider] No se pudo resolver la tienda del canal ${channelId}: ${(error as Error).message}`
        );
        return null;
      }
    }

    return this.implicitSiteId();
  }

  /**
   * La tienda que hereda un mail SIN eje: la única que hay, o ninguna.
   *
   * POR QUÉ EXISTE. Hay ~10 emisores que no pueden declarar su tienda porque el evento
   * que los dispara no la lleva: `auth.password_reset` emite `{ entity_id, token,
   * actor_type }` y `entity_id` ES el email —no hay nada de dónde agarrarse—, y
   * `customer.created` emite `{ id }` de un customer que en Medusa no tiene canal.
   * Están inventariados en `lib/multistore/job-scope.ts`. Para todos ellos `siteId`
   * llegaba en `null`, y con `null` la plantilla de la tienda era INALCANZABLE: el
   * operador la editaba en el admin, la publicaba, y el mail seguía saliendo con el
   * texto del código. Es el bug que este método cierra para el caso mono-tienda.
   *
   * POR QUÉ CON UNA SOLA TIENDA ES CORRECTO Y NO UNA ADIVINANZA. El registro tiene UNA
   * fila: "de qué tienda es este mail" no tiene otra respuesta posible. `singleSite` es
   * el estado que el seam ya define para eso (`lib/multistore/types.ts`) y su criterio
   * es fail-open: con una sola tienda no hay nada que aislar. Y acá el efecto es
   * literalmente ampliar —`pickTemplate` sigue cayendo a la global si la tienda no
   * tiene la suya—, no restringir.
   *
   * POR QUÉ CON VARIAS DEVUELVE `null`, Y ESO NO ES DEUDA. Elegir una tienda cuando hay
   * varias le mandaría al cliente de la tienda B un mail con la marca, el remitente y
   * los links de la A. No hay señal de que pasó: el mail YA SALIÓ. Por eso NO se pasa
   * `allowMainFallback` —caer a la `is_main` es exactamente esa adivinanza, y
   * `request.ts` ya la prohíbe en el admin por el mismo motivo—. Un `site_id` adivinado
   * no es media migración: es una mentira con formato correcto. El arreglo del caso
   * multitienda es aguas arriba y no acá: sellar la tienda en el alta del cliente, y
   * resolver la URL del storefront por tienda. Ver la entrada
   * `subscribers/password-reset-email` en `job-scope.ts`.
   *
   * COSTO. Una query, cacheada `IMPLICIT_SITE_TTL_MS` incluido el `null` — el valor que
   * más se consulta es justamente el de la instalación multitienda.
   */
  private async implicitSiteId(): Promise<string | null> {
    if (!this.pgConnection) return null;

    const now = Date.now();
    const cached = this.implicitSiteCache;
    if (cached && now - cached.at < EmailNotificationProviderService.IMPLICIT_SITE_TTL_MS) {
      return cached.value;
    }

    let value: string | null = null;
    try {
      // Hint VACÍO a propósito: sin pistas, `resolveSiteViaSql` devuelve `singleSite`
      // con una fila y `allSites` con dos o más, en UNA consulta (`LIMIT 2`). Es la
      // pregunta que hay que hacer, escrita con el vocabulario del seam.
      const resolution = await resolveSiteViaSql(this.pgConnection, {});
      value = resolution.status === 'singleSite' ? resolution.site.id : null;
    } catch (error) {
      this.logger.warn(
        `[email-provider] No se pudo resolver la tienda implícita: ${(error as Error).message}`
      );
      value = null;
    }

    this.implicitSiteCache = { value, at: now };
    return value;
  }

  /**
   * Resolve the final subject/html for a notification:
   * 1. `__inline__` → send the pre-rendered subject/html in `data` (test send).
   * 2. Published DB template (Handlebars) rendered with `data`.
   * 3. Hardcoded template function in `./templates` (legacy fallback).
   */
  private async resolveContent(
    key: string,
    data: Record<string, unknown>,
    siteId: string | null
  ): Promise<Resolved | null> {
    if (key === INLINE_TEMPLATE_KEY) {
      return {
        subject: (data.__subject as string) ?? '',
        html: (data.__html as string) ?? '',
      };
    }

    const dbTemplate = await this.loadDbTemplate(key, siteId);
    if (dbTemplate) {
      const rendered = renderEmailTemplate({
        subject: dbTemplate.subject,
        html: dbTemplate.html,
        data,
      });
      return { subject: rendered.subject, html: rendered.html };
    }

    const templateFn = templates[key];
    if (!templateFn) {
      this.warnTemplateMissing(key, siteId);
      return null;
    }
    return templateFn(data);
  }

  /**
   * El mail NO SALIÓ, y hasta ahora eso se leía `No template found for: <key>`.
   *
   * ── POR QUÉ ESTE WARN SE REESCRIBIÓ (2026-09-03) ────────────────────────────
   *
   * Cuando `resolveContent` devuelve `null`, `send()` devuelve `{}` sin lanzar.
   * Eso es DELIBERADO y no se toca: un mail que no sale no puede tumbar un
   * checkout. El problema es lo que pasa después: el módulo de notificaciones de
   * Medusa toma el `{}` como envío exitoso y la fila de `notification` queda en
   * `status = 'success'`. O sea que el ÚNICO rastro de un correo que nunca
   * existió es esta línea del log — y decía "no encontré una plantilla", que
   * suena a detalle de configuración, no a "este mail se perdió".
   *
   * Hay 18 claves que se emiten por el canal de mail y no tienen plantilla en el
   * código (los `recurring-*`, los `gift-card-*`, `corporate-register` y sus
   * `-admin`, los invites y las dos de contacto). Hoy varias son inocuas porque
   * dependen de una fila publicada en `email_template` o de features apagadas,
   * pero la que se prenda sin su fila se cae por acá en silencio. El piso
   * conocido lo fija `modules/notification-template-keys.test.ts`; esto es lo que
   * cubre el caso que un test no puede ver: la instalación del cliente, donde la
   * plantilla vive en la base y puede no estar.
   *
   * ── POR QUÉ CON THROTTLING ──────────────────────────────────────────────────
   *
   * Mismo patrón y mismo motivo que `warnTemplateOutOfScope`: `order.placed`
   * puede emitir miles de mails por día. Un warn por envío no es una señal, es un
   * muro que tapa el resto del log — y un warn que nadie lee vale lo mismo que no
   * tenerlo. La clave del throttle incluye la tienda porque el diagnóstico es
   * distinto en cada una: en la tienda A puede haber fila publicada y en la B no.
   */
  private warnTemplateMissing(key: string, siteId: string | null): void {
    const cacheKey = `${key}::${siteId ?? ''}`;
    const now = Date.now();
    const last = this.warnedMissingTemplate.get(cacheKey);
    if (
      last !== undefined &&
      now - last < EmailNotificationProviderService.MISSING_TEMPLATE_WARN_TTL_MS
    ) {
      return;
    }
    this.warnedMissingTemplate.set(cacheKey, now);

    const origen = siteId
      ? `la tienda "${siteId}"`
      : 'un mail SIN tienda (su emisor no declara `site_id` ni `sales_channel_id`)';
    this.logger.warn(
      `[email-provider] EL MAIL "${key}" NO SE ENVIÓ: no hay ninguna fila publicada en ` +
        `"email_template" alcanzable desde ${origen} y tampoco existe la plantilla en el ` +
        `código (modules/email/templates/index.ts). El envío se descarta en silencio y la ` +
        `fila de "notification" igual queda en status='success', así que ESTE LOG es el ` +
        `único rastro. Se arregla publicando la plantilla desde el admin (Plantillas de ` +
        `email → clave "${key}", con site_id null para que la hereden todas las tiendas) o ` +
        `agregando la plantilla de código. Warn throttleado a 1 cada ` +
        `${EmailNotificationProviderService.MISSING_TEMPLATE_WARN_TTL_MS / 1000}s por ` +
        `(clave, tienda).`
    );
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    const apiKey = readForeignSetting('extension:email-templates', 'SENDGRID_API_KEY');
    const mailer = new MailService();
    if (apiKey) mailer.setApiKey(apiKey);
    const data = (notification.data || {}) as Record<string, unknown>;

    // Inject brand presentation as DEFAULTS — caller-provided values always win.
    // This lets both code templates and DB templates receive brand colors/logo
    // without every caller passing them.
    // Una sola resolución por envío: la usan el branding, la plantilla Y el
    // remitente — `from` se arma DESPUÉS de esta línea a propósito, porque el
    // nombre visible sale de `cde_display_name`. Ver `senderWithDisplayName`.
    const siteId = await this.siteIdForNotification(data);
    const branding = await this.loadBranding(siteId);
    const from = senderWithDisplayName(
      readForeignSetting('extension:email-templates', 'EMAIL_FROM') || this.options.from,
      branding.cde_display_name
    );
    // Treat empty strings as "unset" too — callers (and seed sample_data) may
    // pass `logo_url: ''`, which `??=` would not override, blanking the logo.
    const fillEmpty = (key: string, value: unknown) => {
      const cur = data[key];
      if (cur === undefined || cur === null || cur === '') data[key] = value;
    };
    fillEmpty('primary_color', branding.primary_color);
    fillEmpty('text_color', branding.text_color);
    fillEmpty('logo_url', branding.logo_url);
    fillEmpty('cde_display_name', branding.cde_display_name);
    /**
     * `sales_channel_name` NO LO LLENABA NADIE, y es el asunto de la mitad de los mails.
     *
     * Está declarado en el catálogo de variables de cinco plantillas
     * (`template-variables.ts`) y encabeza el subject de otras tantas —
     * `[{{sales_channel_name}}] Restablecer tu contraseña`,
     * `[{{sales_channel_name}}] Confirmación de registro`—, pero ningún emisor lo manda
     * y hasta acá tampoco se inyectaba. Handlebars resuelve la variable ausente a
     * cadena vacía SIN error, así que el mail salía con el asunto
     * `[] Restablecer tu contraseña`: corchetes vacíos, sin una sola línea en el log.
     * En desdeelsur (2026-08-28) eran 0 de 59 notificaciones de mail las que la traían.
     *
     * El valor correcto es el nombre de la TIENDA, y ya está resuelto acá: `branding`
     * se leyó recién para el `site_id` de este mail, con precedencia tienda → global.
     * No cuesta una query más y no adivina nada — es el mismo nombre que ya viaja en
     * `cde_display_name`.
     *
     * Va por `fillEmpty` como todo el resto: el emisor que SÍ conoce el canal real
     * (los de órdenes lo mandan) sigue ganando.
     */
    fillEmpty('sales_channel_name', branding.cde_display_name);
    fillEmpty('year', new Date().getFullYear());
    fillEmpty(
      'primary_color_bg',
      hexToRgba(String(data.primary_color || branding.primary_color), 0.1)
    );

    // Resolver logo: URL pública del bucket (S3_PUBLIC_URL/cde-logos/...)
    if (data.logo_url && typeof data.logo_url === 'string') {
      data.logo_url = resolveLogoForEmail(data.logo_url) ?? data.logo_url;
    }

    const resolved = await this.resolveContent(notification.template as string, data, siteId);
    if (!resolved) {
      return {};
    }

    const { subject, html, templateId } = resolved;

    // ── UN `to`, VARIAS CASILLAS ─────────────────────────────────────────────
    //
    // Los avisos internos pueden tener más de un destinatario (`ADMIN_EMAIL` y
    // `admin_notification_email` los guardan separados por coma) y SendGrid los
    // quiere como array: pasarle la cadena cruda la trataría como UNA dirección
    // con comas adentro y el envío entero rebota con un 400.
    //
    // Sin comas esto devuelve un array de uno y el mail sale exactamente igual
    // que antes — que es el caso del 100% de los mails al cliente.
    //
    // El fallback a `notification.to` crudo NO es defensivo por costumbre: si
    // algún emisor manda algo que este parser no reconoce como mail, el envío
    // tiene que llegar a SendGrid y fallar ahí, con el motivo real en el log, en
    // vez de desaparecer acá con un `to` vacío y un 202 mentiroso.
    const recipients = parseRecipientList(notification.to);
    const to = recipients.length ? recipients : notification.to;

    // Si el templateId no está configurado o es el placeholder, enviar con HTML para que el email llegue igual
    const useSendGridTemplate =
      templateId && templateId !== 'd-xxxxxxxx' && templateId.startsWith('d-');

    if (!apiKey) {
      this.logger.info(`[EMAIL LOG] From: ${senderForLog(from)}, To: ${notification.to}, Subject: ${subject}`);
      this.logger.debug(`[EMAIL LOG] Content: ${html.substring(0, 200)}...`);
      return { id: `log-${Date.now()}` };
    }

    try {
      if (useSendGridTemplate) {
        const [response] = await mailer.send({
          to,
          from,
          templateId: templateId,
          dynamicTemplateData: notification.data || {},
        });
        const messageId = response?.headers
          ? (response.headers as Record<string, string>)['x-message-id']
          : undefined;
        this.logger.info(
          `Email sent via SendGrid (template: ${templateId}) to ${notification.to} from ${senderForLog(from)}`
        );
        return { id: messageId };
      }

      const [response] = await mailer.send({
        to,
        from,
        subject,
        html,
      });
      const messageId = response?.headers
        ? (response.headers as Record<string, string>)['x-message-id']
        : undefined;
      this.logger.info(`Email sent via SendGrid to ${notification.to} from ${senderForLog(from)}`);
      return { id: messageId };
    } catch (error) {
      this.logger.error(`Failed to send email to ${notification.to}:`, error as Error);
      throw error;
    }
  }
}

export default EmailNotificationProviderService;
