import { defineSettings } from './types';

/**
 * Ajustes de WhatsApp (Kapso).
 *
 * El manifest declaraba 3 variables (`KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`,
 * `KAPSO_BASE_URL`) y el código usa 25: la auditoría de este namespace corrigió
 * esa deriva y `manifest-drift.test.ts` la mantiene cerrada.
 *
 * DOS DECISIONES QUE NO SON OBVIAS, y que hay que respetar al editar esto:
 *
 * 1. Los cuatro `KAPSO_*` de conexión también viajan como `options` del
 *    notification provider en `medusa-config.ts:423-427`, o sea CONGELADOS al
 *    arrancar. Aun así son `runtime` y no `envOnly`, porque el provider ya no
 *    los lee de sus options: los resuelve en cada `send()` con
 *    `loadKapsoSettingsViaPg()`, que lee `site_setting` por `PG_CONNECTION` con
 *    knex crudo (memoizado 30 s) — el único camino que funciona dentro de su
 *    contenedor hermético. Las options quedan sólo como último fallback, para
 *    instalaciones que hardcodean credenciales en `medusa-config.ts`.
 *
 * 2. Los nombres opcionales de plantillas de campañas y suscripciones NO tienen
 *    `default` A PROPÓSITO. En esos
 *    casos el código usa la PRESENCIA del valor como interruptor: sin valor, el
 *    paso de WhatsApp no se arma (`abandoned-cart/config.ts:59-77`,
 *    `workflows/process-renewal-cycle.ts:515-517`,
 *    `jobs/process-recurring-renewals.ts:73`). Ponerles un default los
 *    encendería a todos en silencio y la tienda empezaría a mandar plantillas
 *    que Meta nunca aprobó → mensajes rechazados. El literal de fallback vive en
 *    `kapso-whatsapp/templates/index.ts`, que sólo corre cuando el interruptor
 *    ya dijo que sí.
 */
export default defineSettings({
  namespace: 'extension:whatsapp',
  title: 'WhatsApp (Kapso)',
  /**
   * main resuelve el número por tienda con `site_credential`, y la tienda viaja en
   * la `data` de la notificación. Las plantillas acompañan a la cuenta.
   */
  defaultScope: 'site',
  envOnly: [
    {
      key: 'KAPSO_CONFIG_ID',
      reason:
        'Sólo se pasa como option del provider en medusa-config.ts:427 y hoy nadie la consume (ver KapsoProviderOptions: "cableados para uso futuro"). Gestionarla desde la base daría un campo que no hace nada.',
    },
    {
      key: 'WHATSAPP_SALES_CHANNEL_ID',
      reason:
        'Reemplazada por Admin → WhatsApp → Ajustes → Canales del bot, que guarda la selección en store_setting y admite varios canales. Se mantiene sólo como fallback de instalaciones viejas (lib/whatsapp/order-context.ts:79).',
    },
  ],
  settings: [
    // ─── Conexión ────────────────────────────────────────────────────────────
    {
      key: 'KAPSO_BASE_URL',
      env: ['KAPSO_BASE_URL'],
      type: 'url',
      tier: 'runtime',
      group: 'Conexión',
      label: 'URL de la API de Kapso',
      help: 'Sólo se cambia para apuntar a un entorno propio de Kapso. Por defecto, la API pública.',
      placeholder: 'https://api.kapso.ai',
      default: 'https://api.kapso.ai',
    },
    {
      key: 'KAPSO_PHONE_NUMBER_ID',
      env: ['KAPSO_PHONE_NUMBER_ID'],
      type: 'string',
      tier: 'runtime',
      group: 'Conexión',
      label: 'ID del número de teléfono',
      help: 'El `phone_number_id` de Meta que emite los mensajes. Sin esto no se envía nada: todo queda logueado.',
      pattern: '^[0-9]{5,32}$',
      maxLength: 32,
      required: true,
    },
    {
      key: 'KAPSO_BUSINESS_ACCOUNT_ID',
      env: ['KAPSO_BUSINESS_ACCOUNT_ID'],
      type: 'string',
      tier: 'runtime',
      group: 'Conexión',
      label: 'ID de la cuenta de WhatsApp Business (WABA)',
      help: 'Necesario SÓLO para crear y editar plantillas desde el admin. El envío de mensajes no lo usa.',
      pattern: '^[0-9]{5,32}$',
      maxLength: 32,
    },
    {
      key: 'KAPSO_INBOX_EMBED_URL',
      env: ['KAPSO_INBOX_EMBED_URL'],
      type: 'url',
      tier: 'runtime',
      group: 'Conexión',
      label: 'URL del inbox embebido',
      help: 'Se saca de Kapso → Project → Inbox Embeds. Es un token de un solo propósito: se muestra en un iframe del admin, la API key nunca viaja al browser.',
      placeholder: 'https://app.kapso.ai/embed/inbox/...',
    },

    // ─── Credenciales ────────────────────────────────────────────────────────
    {
      key: 'KAPSO_API_KEY',
      env: ['KAPSO_API_KEY'],
      type: 'secret',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'API key',
      help: 'Autentica contra Kapso (header X-API-Key). Nunca se muestra: sólo se puede reemplazar o borrar.',
      required: true,
    },
    // Los dos de abajo son el contrato del webhook ENTRANTE, no una cuenta: el
    // handler los lee ANTES de saber de qué tienda es el evento —y el challenge GET
    // no tiene tienda ninguna—, así que son `instance` aunque el namespace sea
    // `site`. `applyPlan` los manda solos a la fila global. Ver la nota de
    // `INBOUND_CONTRACT_KEYS` en `credential-presentation.ts`.
    {
      key: 'KAPSO_WEBHOOK_SECRET',
      env: ['KAPSO_WEBHOOK_SECRET'],
      type: 'secret',
      tier: 'runtime',
      scope: 'instance',
      group: 'Credenciales',
      label: 'Secreto de firma del webhook',
      help: 'Con esto se valida el HMAC-SHA256 de cada evento entrante. Vacío = no se verifica la firma: dejalo puesto en producción.',
    },
    {
      key: 'KAPSO_WEBHOOK_VERIFY_TOKEN',
      env: ['KAPSO_WEBHOOK_VERIFY_TOKEN'],
      type: 'secret',
      tier: 'runtime',
      scope: 'instance',
      group: 'Credenciales',
      label: 'Token de verificación del webhook',
      help: 'El challenge estilo Meta (GET con hub.verify_token). Sin esto, Kapso no puede dar de alta la suscripción.',
    },

    // ─── Plantillas ──────────────────────────────────────────────────────────
    {
      key: 'KAPSO_TEMPLATE_LANG',
      env: ['KAPSO_TEMPLATE_LANG'],
      type: 'string',
      tier: 'runtime',
      group: 'Plantillas',
      label: 'Idioma de las plantillas',
      help: 'Código de idioma de Meta. Tiene que coincidir EXACTAMENTE con el de la plantilla aprobada: "es" y "es_AR" son plantillas distintas.',
      placeholder: 'es',
      pattern: '^[a-z]{2}(_[A-Z]{2})?$',
      maxLength: 6,
      default: 'es',
    },
    {
      key: 'KAPSO_TEMPLATE_ORDER_CONFIRMATION',
      env: ['KAPSO_TEMPLATE_ORDER_CONFIRMATION'],
      type: 'string',
      tier: 'runtime',
      group: 'Plantillas',
      label: 'Confirmación de pedido',
      help: 'Body: nombre, nº de pedido, total.',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
      default: 'order_confirmation',
    },
    {
      key: 'KAPSO_TEMPLATE_ORDER_TRACKING',
      env: ['KAPSO_TEMPLATE_ORDER_TRACKING'],
      type: 'string',
      tier: 'runtime',
      group: 'Plantillas',
      label: 'Seguimiento de envío',
      help: 'Lo dispara Andreani al generar el ticket. Body: nombre, nº, tracking, link.',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
      default: 'order_tracking',
    },
    {
      key: 'KAPSO_TEMPLATE_ORDER_DELIVERY',
      env: ['KAPSO_TEMPLATE_ORDER_DELIVERY'],
      type: 'string',
      tier: 'runtime',
      group: 'Plantillas',
      label: 'En camino (flota propia)',
      help: 'Body: nombre, nº, conductor, tipo de vehículo, teléfono del conductor.',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
      default: 'order_delivery_own_fleet',
    },
    {
      key: 'KAPSO_TEMPLATE_ORDER_CANCELLED',
      env: ['KAPSO_TEMPLATE_ORDER_CANCELLED'],
      type: 'string',
      tier: 'runtime',
      group: 'Plantillas',
      label: 'Pedido cancelado',
      help: 'Body: nombre, nº de pedido.',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
      default: 'order_cancelled',
    },
    {
      key: 'KAPSO_TEMPLATE_PASSWORD_RESET',
      env: ['KAPSO_TEMPLATE_PASSWORD_RESET'],
      type: 'string',
      tier: 'runtime',
      group: 'Plantillas',
      label: 'Restablecer contraseña',
      help: 'Body: nombre, link de reseteo.',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
      default: 'password_reset',
    },

    {
      key: 'KAPSO_TEMPLATE_ORDER_READY_FOR_PICKUP',
      env: ['KAPSO_TEMPLATE_ORDER_READY_FOR_PICKUP'],
      type: 'string',
      tier: 'runtime',
      group: 'Plantillas',
      label: 'Listo para retirar en tienda',
      help:
        'Lo dispara el botón "Marcar listo para retirar" de la orden (y la transición de la entrega ' +
        'a "en el punto de retiro"). Vacío = el aviso sale sólo por email. Body: nombre, nº, sucursal, dirección.',
      placeholder: 'order_ready_for_pickup',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
    },

    // ─── Carritos y pedidos ──────────────────────────────────────────────────
    // Sin default a propósito: acá el valor vacío es el interruptor de apagado.
    // Ver la nota 2 del encabezado antes de agregarles uno.
    {
      key: 'KAPSO_TEMPLATE_CART_ABANDONED_1',
      env: ['KAPSO_TEMPLATE_CART_ABANDONED_1'],
      type: 'string',
      tier: 'runtime',
      group: 'Carritos y pedidos',
      label: 'Carrito abandonado — paso 1',
      help: 'MARKETING. Vacío = ese paso no manda WhatsApp (sí manda el email). Body: nombre, total, link de recuperación.',
      placeholder: 'cart_abandoned_1',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
    },
    {
      key: 'KAPSO_TEMPLATE_CART_ABANDONED_2',
      env: ['KAPSO_TEMPLATE_CART_ABANDONED_2'],
      type: 'string',
      tier: 'runtime',
      group: 'Carritos y pedidos',
      label: 'Carrito abandonado — paso 2',
      help: 'Vacío = ese paso no manda WhatsApp. Mismos parámetros que el paso 1.',
      placeholder: 'cart_abandoned_2',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
    },
    {
      key: 'KAPSO_TEMPLATE_CART_ABANDONED_3',
      env: ['KAPSO_TEMPLATE_CART_ABANDONED_3'],
      type: 'string',
      tier: 'runtime',
      group: 'Carritos y pedidos',
      label: 'Carrito abandonado — paso 3',
      help: 'Vacío = ese paso no manda WhatsApp. Mismos parámetros que el paso 1.',
      placeholder: 'cart_abandoned_3',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
    },
    ...([
      ['KAPSO_TEMPLATE_RECURRING_ORDER_CREATED', 'Suscripción — alta', 'recurring_order_created'],
      ['KAPSO_TEMPLATE_RECURRING_ORDER_PAUSED', 'Suscripción — pausada', 'recurring_order_paused'],
      ['KAPSO_TEMPLATE_RECURRING_ORDER_RESUMED', 'Suscripción — reanudada', 'recurring_order_resumed'],
      ['KAPSO_TEMPLATE_RECURRING_ORDER_SKIPPED', 'Suscripción — entrega omitida', 'recurring_order_skipped'],
      ['KAPSO_TEMPLATE_RECURRING_ORDER_CANCELLED', 'Suscripción — cancelada', 'recurring_order_cancelled'],
      ['KAPSO_TEMPLATE_RECURRING_ORDER_GENERATED', 'Suscripción — pedido generado', 'recurring_order_generated'],
      ['KAPSO_TEMPLATE_RECURRING_ORDER_UPDATED', 'Suscripción — datos actualizados', 'recurring_order_updated'],
    ] as const).map(([key, label, placeholder]) => ({
      key,
      env: [key],
      type: 'string' as const,
      tier: 'runtime' as const,
      group: 'Carritos y pedidos',
      label,
      help: 'Vacío = el aviso sale sólo por email. Body: nombre, suscripción, próxima fecha.',
      placeholder,
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
    })),
    {
      key: 'KAPSO_TEMPLATE_RECURRING_RENEWAL_READY',
      env: ['KAPSO_TEMPLATE_RECURRING_RENEWAL_READY'],
      type: 'string',
      tier: 'runtime',
      group: 'Carritos y pedidos',
      label: 'Suscripción — renovación lista para pagar',
      help: 'Vacío = el aviso sale sólo por email. Body: nombre, total, link de confirmación.',
      placeholder: 'recurring_renewal_ready',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
    },
    {
      key: 'KAPSO_TEMPLATE_RECURRING_RENEWAL_UPCOMING',
      env: ['KAPSO_TEMPLATE_RECURRING_RENEWAL_UPCOMING'],
      type: 'string',
      tier: 'runtime',
      group: 'Carritos y pedidos',
      label: 'Suscripción — próximo cobro automático',
      help: 'Vacío = el aviso sale sólo por email. Body: nombre, total, frecuencia.',
      placeholder: 'recurring_renewal_upcoming',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
    },
    {
      key: 'KAPSO_TEMPLATE_RECURRING_RENEWAL_REMINDER',
      env: ['KAPSO_TEMPLATE_RECURRING_RENEWAL_REMINDER'],
      type: 'string',
      tier: 'runtime',
      group: 'Carritos y pedidos',
      label: 'Suscripción — recordatorio de pago',
      help: 'Vacío = el recordatorio sale sólo por email. Body: nombre, link de confirmación.',
      placeholder: 'recurring_renewal_reminder',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
    },
    {
      key: 'KAPSO_TEMPLATE_RECURRING_ORDER_FAILED',
      env: ['KAPSO_TEMPLATE_RECURRING_ORDER_FAILED'],
      type: 'string',
      tier: 'runtime',
      group: 'Carritos y pedidos',
      label: 'Suscripción — renovación fallida',
      help: 'Vacío = el aviso sale sólo por email. Body: nombre, frecuencia.',
      placeholder: 'recurring_order_failed',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
    },
    {
      key: 'KAPSO_TEMPLATE_RECURRING_STOCK_UNAVAILABLE',
      env: ['KAPSO_TEMPLATE_RECURRING_STOCK_UNAVAILABLE'],
      type: 'string',
      tier: 'runtime',
      group: 'Carritos y pedidos',
      label: 'Suscripción — stock no disponible',
      help: 'Vacío = el aviso sale sólo por email. Body: suscripción, ciclo.',
      placeholder: 'recurring_stock_unavailable',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
    },
    {
      key: 'KAPSO_TEMPLATE_RECURRING_STOCK_SKIPPED',
      env: ['KAPSO_TEMPLATE_RECURRING_STOCK_SKIPPED'],
      type: 'string',
      tier: 'runtime',
      group: 'Carritos y pedidos',
      label: 'Suscripción — ciclo omitido por stock',
      help: 'Vacío = el aviso sale sólo por email. Body: suscripción, ciclo.',
      placeholder: 'recurring_stock_skipped',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
    },
    {
      key: 'KAPSO_TEMPLATE_RECURRING_PAYMENT_FAILED',
      env: ['KAPSO_TEMPLATE_RECURRING_PAYMENT_FAILED'],
      type: 'string',
      tier: 'runtime',
      group: 'Carritos y pedidos',
      label: 'Suscripción — cobro rechazado',
      help: 'Vacío = el aviso sale sólo por email. Body: suscripción, ciclo.',
      placeholder: 'recurring_payment_failed',
      pattern: '^[a-z0-9_]+$',
      maxLength: 512,
    },

    // ─── Bot ─────────────────────────────────────────────────────────────────
    {
      key: 'WHATSAPP_REGION_ID',
      env: ['WHATSAPP_REGION_ID'],
      type: 'string',
      tier: 'runtime',
      group: 'Bot',
      label: 'Región de los pedidos del bot',
      help: 'Define moneda y precios de lo que arma el bot. Si se deja vacío se deduce del país; si esa deducción falla, el bot no puede cotizar.',
      placeholder: 'reg_01ABC...',
      pattern: '^reg_[A-Za-z0-9]+$',
      maxLength: 64,
    },
    {
      key: 'WHATSAPP_COUNTRY_CODE',
      env: ['WHATSAPP_COUNTRY_CODE'],
      type: 'string',
      tier: 'runtime',
      group: 'Bot',
      label: 'País del bot (ISO-2)',
      // Sin default: si no hay valor, el código sigue cayendo a
      // STOREFRONT_DEFAULT_COUNTRY y recién después a "ar". Un default acá
      // cortaría ese eslabón y rompería tiendas que sólo configuran la del
      // storefront.
      help: 'Se usa para elegir la región cuando no hay una fijada. Si queda vacío se hereda de STOREFRONT_DEFAULT_COUNTRY y, en última instancia, "ar".',
      placeholder: 'ar',
      pattern: '^[A-Za-z]{2}$',
      maxLength: 2,
    },
    {
      key: 'WHATSAPP_PLACEHOLDER_IMAGE_URL',
      env: ['WHATSAPP_PLACEHOLDER_IMAGE_URL'],
      type: 'url',
      tier: 'runtime',
      group: 'Bot',
      label: 'Imagen de reemplazo del catálogo',
      help: 'Meta rechaza el carrusel COMPLETO si no puede decodificar una sola imagen. Con esto, los productos sin foto usable entran igual; sin esto, el bot cae a la lista de texto.',
      placeholder: 'https://cdn.tu-tienda.com/placeholder.jpg',
    },

    /**
     * LA PUERTA DE ENTRADA DEL BOT (DESDEELSUR-72, TC-000).
     *
     * El router resuelve saludos, taps y las intenciones que reconoce; todo lo
     * demás cae al agente conversacional. Eso hace que el PRIMER mensaje del
     * cliente decida en qué bot entra: "Hola" abre el menú documentado y
     * "busco algo para pintar el techo" abre un asistente libre que no está en
     * ningún árbol, con otro formato de opciones y sin las garantías del
     * recorrido. QA lo midió como bifurcación no controlada, y los cinco
     * hallazgos de esa rama son de ahí.
     *
     * Encendido, el texto libre de una sesión NUEVA abre el menú en lugar de
     * caer al modelo. Una vez adentro del recorrido nada cambia: el agente
     * sigue atendiendo lo que el router deliberadamente no resuelve
     * (asesoramiento, devoluciones).
     *
     * Default `true` A PROPÓSITO, y es un cambio de comportamiento para toda
     * tienda derivada: el §8/§23 del PRD ya pide que un saludo nunca caiga al
     * modelo, y esta rama era el agujero de esa intención, no una capacidad.
     * Una tienda que quiera la conversación abierta como entrada lo apaga acá.
     */
    {
      key: 'WHATSAPP_GUIDED_ENTRY',
      env: ['WHATSAPP_GUIDED_ENTRY'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Bot',
      label: 'El primer mensaje abre el menú',
      help: 'Encendido, un mensaje de texto libre que arranca la conversación abre el menú del recorrido en vez de ir al asistente conversacional. Apagado, ese primer mensaje lo atiende el modelo, que responde con su propio formato y fuera del árbol documentado.',
      default: true,
    },

    /**
     * QUÉ AGENTE ATIENDE EL BOT (DESDEELSUR-72).
     *
     * La key estaba HARDCODEADA en `api/webhooks/kapso/route.ts` y el resolver
     * falla ABIERTO: si no existe una fila con esa key, `resolveAgentByKey`
     * devuelve el `GENERAL_AGENT`, que tiene `instructions: ''` y
     * `allowedTools: null`. O sea, el bot de cara al cliente atendiendo con el
     * prompt VACÍO y viendo todas las tools de la instalación.
     *
     * No es hipotético: en desdeelsur el agente del bot se llama `wanda`, no
     * `whatsapp`, así que TODO su prompt —formato de opciones, asesor guiado,
     * reglas de honestidad— nunca se ejecutó. Los cinco hallazgos que QA
     * atribuyó al "asistente libre" son eso.
     *
     * Renombrar o recrear el agente desde el admin es normal; que eso apague el
     * prompt en silencio, no. Con esta clave la tienda apunta al suyo, y el
     * webhook además corta el turno si no lo encuentra.
     */
    {
      key: 'WHATSAPP_AGENT_KEY',
      env: ['WHATSAPP_AGENT_KEY'],
      type: 'string',
      tier: 'runtime',
      group: 'Bot',
      label: 'Agente que atiende el bot',
      help: 'La `key` del agente de IA (Asistente IA → Agentes) que responde los mensajes que el recorrido determinístico no resuelve. Si acá hay una key que no existe, el bot NO le habla al cliente con un agente improvisado: corta y le ofrece el menú.',
      default: 'whatsapp',
      placeholder: 'whatsapp',
      maxLength: 64,
    },

    // ─── Handoff ─────────────────────────────────────────────────────────────
    {
      key: 'WHATSAPP_HANDOFF_AUTO_RESUME_HOURS',
      env: ['WHATSAPP_HANDOFF_AUTO_RESUME_HOURS'],
      type: 'number',
      tier: 'runtime',
      group: 'Handoff',
      label: 'Volver al bot tras (horas)',
      help: 'Cuando una persona toma la conversación el bot se calla. Si nadie la cierra, vuelve solo pasadas estas horas.',
      min: 1,
      max: 720,
      step: 1,
      default: 6,
    },
  ],
});
