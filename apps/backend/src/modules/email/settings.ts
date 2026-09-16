import emailTemplatesDescriptors from '../app-settings/descriptors/email-templates';
import { resolveSettingSync } from '../app-settings/resolve';

/**
 * Configuración efectiva de las plantillas de email, con la precedencia
 * **DB > env > default** de `app-settings`.
 *
 * Es SINCRÓNICA porque los tres consumidores no pueden esperar una promesa:
 * `templates/email-helpers.ts` arma el `<img>` de cada icono dentro de un
 * renderizador de strings, y los dos workflows de invitación leen el ID de
 * plantilla en un `const` de nivel superior. Lee del snapshot que el loader de
 * `app-settings` llena al arrancar; hasta entonces cae a `process.env`.
 *
 * Copia del patrón de `modules/typesense/settings.ts`.
 *
 * `SENDGRID_API_KEY` y `EMAIL_FROM` NO están acá: son opciones de boot del
 * provider de notificaciones y viven en `envOnly`. Tampoco `S3_PUBLIC_URL`, que
 * es de `media-library` — ver la cabecera del descriptor.
 */

export type EmailTemplateSettings = {
  /** Destinatario de los avisos internos. Vacío = no se manda ninguno. */
  adminEmail: string;
  /** Base pública de los PNG del email, sin barra final. Vacío = sin iconos. */
  iconsBaseUrl: string;
  /** ID de plantilla dinámica de SendGrid: invitación a empresa (B2B). */
  companyInviteTemplateId: string;
  /** ID de plantilla dinámica de SendGrid: invitación corporativa. */
  corporateInviteTemplateId: string;
  /**
   * Qué tiene que presentar el cliente para retirar su pedido en el local.
   * Vacío = el mail de "listo para retirar" no dibuja ese bloque, que es lo que
   * pide el ticket ("si corresponde").
   */
  pickupInstructions: string;
};

const DEFAULTS: EmailTemplateSettings = {
  adminEmail: '',
  iconsBaseUrl: '',
  companyInviteTemplateId: 'company-invite',
  corporateInviteTemplateId: 'corporate-invite',
  pickupInstructions: '',
};

const byKey = new Map(emailTemplatesDescriptors.settings.map((d) => [d.key, d]));

function read(key: string, fallback: string): string {
  const descriptor = byKey.get(key);
  if (!descriptor) return fallback;
  const value = resolveSettingSync(descriptor);
  if (typeof value !== 'string') return fallback;
  return value.trim() || fallback;
}

export function getEmailTemplateSettings(): EmailTemplateSettings {
  return {
    adminEmail: read('ADMIN_EMAIL', DEFAULTS.adminEmail),
    // Sin barra final: los call sites concatenan `${base}/${archivo}` y una
    // barra de más rompe la URL en algunos CDNs.
    iconsBaseUrl: read('EMAIL_ICONS_BASE_URL', DEFAULTS.iconsBaseUrl).replace(/\/+$/, ''),
    companyInviteTemplateId: read(
      'COMPANY_INVITE_SENDGRID_TEMPLATE_ID',
      DEFAULTS.companyInviteTemplateId,
    ),
    corporateInviteTemplateId: read(
      'CORPORATE_INVITE_SENDGRID_TEMPLATE_ID',
      DEFAULTS.corporateInviteTemplateId,
    ),
    pickupInstructions: read('ORDER_PICKUP_INSTRUCTIONS', DEFAULTS.pickupInstructions),
  };
}
