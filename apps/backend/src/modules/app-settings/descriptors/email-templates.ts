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
      label: 'Emails de avisos al administrador',
      /**
       * UNA oración, y la que se queda es la del FORMATO: que se puede poner más
       * de una casilla y cómo se separan no se deduce parado frente a un campo de
       * texto, y escribir dos mails pegados sin coma manda el aviso a ninguna.
       * Las dos capas —que Preferencias → Emails pisa a esto y que vacío en los
       * dos lugares no manda nada— siguen en la sección "Los avisos internos
       * tienen dos capas" del drawer.
       */
      help: 'Reciben las notificaciones internas (pedidos nuevos, alertas); varias casillas se separan con coma.',
      placeholder: 'ventas@tutienda.com, admin@tutienda.com',
      /**
       * Una casilla, o varias separadas por coma o punto y coma. El separador
       * ADMITE el espacio a los costados porque una lista pegada de otro lado lo
       * trae, y `parseRecipientList` (en `modules/email/settings.ts`) lo limpia:
       * rechazar acá lo que el parser sí entiende sería trabar el guardado por un
       * espacio invisible.
       */
      pattern:
        '^\\s*[^@\\s,;]+@[^@\\s,;]+\\.[^@\\s,;]+\\s*([,;]\\s*[^@\\s,;]+@[^@\\s,;]+\\.[^@\\s,;]+\\s*)*$',
      // 254 es el largo de UNA casilla. Con lista, el techo tiene que dar para
      // varias: 1000 entra cómodo un equipo de cuatro o cinco y sigue siendo un
      // tope, no una invitación a pegar una base de datos acá.
      maxLength: 1000,
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

    // ─── Retiro en tienda ────────────────────────────────────────────────────
    {
      key: 'ORDER_PICKUP_INSTRUCTIONS',
      env: ['ORDER_PICKUP_INSTRUCTIONS'],
      type: 'string',
      tier: 'runtime',
      group: 'Retiro en tienda',
      label: 'Qué presentar para retirar',
      /**
       * UNA oración. Vacío NO es un error: el ticket pide la indicación "si
       * corresponde", así que sin valor el bloque simplemente no se dibuja. El
       * resto —que el mail sale igual, y que la sucursal y los horarios salen de
       * la ficha de cada sucursal y no de acá— está en el drawer.
       */
      help: 'Se muestra en el mail de "pedido listo para retirar"; vacío no dibuja el bloque.',
      placeholder: 'Presentá tu DNI y el número de pedido.',
      maxLength: 500,
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
