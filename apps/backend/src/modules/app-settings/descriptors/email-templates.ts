import { defineSettings } from './types';

/** Runtime settings. Account fields are edited in Settings > Integrations.
 * Shared providers retain their persisted namespace for compatibility. */
export default defineSettings({
  namespace: 'extension:email-templates',
  title: 'Emails (SendGrid)',
  /**
   * `instance`. Hay UNA cuenta de SendGrid por instancia (una sola
   * `SENDGRID_API_KEY`, que es opción de boot del provider), así que los IDs de
   * plantilla y el remitente viven en ese mismo plano. Y las dos plantillas de
   * invitación se leen desde un `const` de nivel superior de un workflow, sin
   * request: con `scope: 'site'` nunca leerían la fila de la tienda y encima el
   * fail-closed dejaría a las secundarias sin plantilla. La personalización por
   * tienda que sí existe hoy —logo, colores, mail de aviso— pasa por
   * `store-config.getEmailBranding()`, que ya tiene `site_id`.
   */
  defaultScope: 'instance',
  settings: [
    {
      key: 'SENDGRID_API_KEY',
      env: ['SENDGRID_API_KEY'],
      type: 'secret',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'API key de SendGrid',
      required: true,
    },
    {
      key: 'EMAIL_FROM',
      env: ['EMAIL_FROM'],
      type: 'string',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Remitente verificado',
      default: 'noreply@mercatto.com',
      required: true,
    },
    // ─── Destinatarios ───────────────────────────────────────────────────────
    {
      key: 'ADMIN_EMAIL',
      env: ['ADMIN_EMAIL'],
      type: 'string',
      tier: 'runtime',
      group: 'Destinatarios',
      label: 'Email de avisos al administrador',
      /**
       * UNA oración. Las dos capas —que Preferencias → Emails pisa a esto y que
       * vacío en los dos lugares no manda nada— son la sección "Los avisos internos
       * tienen dos capas" del drawer. Parado frente al campo no se puede adivinar
       * cuál gana, pero tampoco se resuelve leyendo tres renglones cada vez.
       */
      help: 'Recibe las notificaciones internas (pedidos nuevos, alertas).',
      placeholder: 'ventas@tutienda.com',
      pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',
      maxLength: 254,
    },

    // ─── Recursos ────────────────────────────────────────────────────────────
    {
      key: 'EMAIL_ICONS_BASE_URL',
      env: ['EMAIL_ICONS_BASE_URL'],
      type: 'url',
      tier: 'runtime',
      group: 'Recursos',
      label: 'Base de los iconos del email',
      /**
       * UNA oración, y se queda la que es del CAMPO: "sin barra final" es formato de
       * lo que se tipea acá, no se deduce de ningún lado y romperlo arma URLs con
       * doble barra. El porqué son imágenes hospedadas y qué pasa vacía están en la
       * sección "Los iconos son imágenes hospedadas" del drawer.
       */
      help: 'Carpeta pública con los PNG del timeline y del kit CDE (normalmente …/email-icons en el bucket), sin barra final.',
      placeholder: 'https://cdn.tutienda.com/email-icons',
      maxLength: 512,
    },

    // ─── Plantillas de SendGrid ──────────────────────────────────────────────
    {
      key: 'COMPANY_INVITE_SENDGRID_TEMPLATE_ID',
      env: ['COMPANY_INVITE_SENDGRID_TEMPLATE_ID'],
      type: 'string',
      tier: 'runtime',
      group: 'Plantillas de SendGrid',
      label: 'Invitación a empresa (B2B)',
      /**
       * UNA oración. "Sin valor se usa company-invite" ya lo dice el `default` de
       * abajo, que la UI muestra; el modo de falla —invitación creada que nunca
       * llega— es la sección "Los IDs de plantilla de SendGrid son otra cosa".
       */
      help: 'ID de la plantilla dinámica de SendGrid del mail de invitación a una empresa.',
      placeholder: 'd-0123456789abcdef0123456789abcdef',
      default: 'company-invite',
      maxLength: 120,
    },
    {
      key: 'CORPORATE_INVITE_SENDGRID_TEMPLATE_ID',
      env: ['CORPORATE_INVITE_SENDGRID_TEMPLATE_ID'],
      type: 'string',
      tier: 'runtime',
      group: 'Plantillas de SendGrid',
      label: 'Invitación a cuenta corporativa',
      /** UNA oración: el `default` de abajo ya dice qué se usa sin valor. */
      help: 'Mismo criterio que la anterior, para el flujo corporativo.',
      placeholder: 'd-0123456789abcdef0123456789abcdef',
      default: 'corporate-invite',
      maxLength: 120,
    },
  ],
});
