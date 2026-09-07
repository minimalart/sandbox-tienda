/**
 * Mapeo de templates de notificación de Medusa → templates de WhatsApp aprobados
 * en Kapso/Meta. Es el FALLBACK por código: solo se usa cuando no hay un binding
 * publicado en el admin para ese evento (ver kapso-whatsapp/service.ts).
 *
 * IMPORTANTE: WhatsApp solo permite mensajes business-initiated con templates
 * PREVIAMENTE APROBADOS por Meta. El `name`, el `language.code` y el ORDEN de los
 * parámetros del body deben coincidir con el template aprobado. Los nombres y el
 * idioma son configurables desde Admin → WhatsApp → Ajustes (con fallback a env)
 * para no acoplar el código a la cuenta.
 *
 * La configuración NO se lee acá: entra como argumento. Antes había un
 * `const DEFAULT_LANG = process.env.KAPSO_TEMPLATE_LANG` de nivel superior, que
 * se evaluaba al importar el archivo — o sea durante el arranque, cuando todavía
 * no hay nada leído de la base. Recibiéndola por parámetro, el provider pasa la
 * config que acaba de leer y estos builders quedan como funciones PURAS de
 * `(data, settings)`: mismos argumentos, mismo payload, testeables sin proceso.
 */

import type { KapsoSettings } from '../settings';

export type WhatsappTemplatePayload = {
  name: string;
  language: { code: string };
  components?: Array<Record<string, unknown>>;
};

type TemplateBuilder = (
  data: Record<string, unknown>,
  settings: KapsoSettings,
) => WhatsappTemplatePayload;

/** Arma un único componente `body` con parámetros de texto en orden. */
function bodyParams(...values: Array<unknown>): Array<Record<string, unknown>> {
  return [
    {
      type: 'body',
      parameters: values.map((v) => ({ type: 'text', text: String(v ?? '') })),
    },
  ];
}

export const whatsappTemplates: Record<string, TemplateBuilder> = {
  // Confirmación de pedido — UTILITY. Body: nombre, nº de orden, total.
  'order-confirmation': (data, s) => ({
    name: s.templates.orderConfirmation,
    language: { code: s.templateLang },
    components: bodyParams(data.customer_name ?? '', data.display_id ?? '', data.total ?? ''),
  }),

  // Seguimiento de envío ANDREANI — UTILITY. Body: nombre, nº, tracking, link.
  // Lo dispara `andreani.ticket_generated`, con tracking real ya disponible.
  'order-tracking': (data, s) => ({
    name: s.templates.orderTracking,
    language: { code: s.templateLang },
    components: bodyParams(
      data.customer_name ?? '',
      data.display_id ?? '',
      data.tracking_number ?? '',
      data.tracking_url ?? '',
    ),
  }),

  // "En camino" FLOTA PROPIA — UTILITY. Body: nombre, nº, conductor, tipo de
  // vehículo, teléfono del conductor. Lo dispara
  // `delivery.own_fleet_out_for_delivery`.
  'order-delivery': (data, s) => ({
    name: s.templates.orderDelivery,
    language: { code: s.templateLang },
    components: bodyParams(
      data.customer_name ?? '',
      data.display_id ?? '',
      data.driver_name ?? '',
      data.vehicle_type ?? '',
      data.driver_phone ?? '',
    ),
  }),

  // Pedido cancelado — UTILITY. Body: nombre, nº de orden.
  'order-cancelled': (data, s) => ({
    name: s.templates.orderCancelled,
    language: { code: s.templateLang },
    components: bodyParams(data.customer_name ?? '', data.display_id ?? ''),
  }),

  // Restablecer contraseña — UTILITY. Body: nombre, link de reseteo.
  'password-reset': (data, s) => ({
    name: s.templates.passwordReset,
    language: { code: s.templateLang },
    components: bodyParams(data.customer_name ?? '', data.reset_url ?? ''),
  }),

  // Carrito abandonado — MARKETING. Body: nombre, total, link de recuperación.
  // Los 3 pasos comparten shape de parámetros; cada uno mapea a un template
  // aprobado distinto. El literal de acá es sólo la red de seguridad: si el
  // ajuste está vacío, `abandoned-cart/config.ts` ni arma el paso de WhatsApp,
  // así que en la práctica este builder no llega a correr sin valor.
  'cart-abandoned-1': (data, s) => ({
    name: s.templates.cartAbandoned1 ?? 'cart_abandoned_1',
    language: { code: s.templateLang },
    components: bodyParams(
      data.customer_name ?? '',
      data.total ?? '',
      data.recovery_url ?? '',
    ),
  }),
  'cart-abandoned-2': (data, s) => ({
    name: s.templates.cartAbandoned2 ?? 'cart_abandoned_2',
    language: { code: s.templateLang },
    components: bodyParams(
      data.customer_name ?? '',
      data.total ?? '',
      data.recovery_url ?? '',
    ),
  }),
  'cart-abandoned-3': (data, s) => ({
    name: s.templates.cartAbandoned3 ?? 'cart_abandoned_3',
    language: { code: s.templateLang },
    components: bodyParams(
      data.customer_name ?? '',
      data.total ?? '',
      data.recovery_url ?? '',
    ),
  }),

  // Compras recurrentes — UTILITY (aviso transaccional de una suscripción que el
  // cliente ya creó). Sin el ajuste correspondiente el motor no arma el aviso de
  // WhatsApp (ver workflows/process-renewal-cycle y el job).
  ...Object.fromEntries(
    ([
      ['recurring-order-created', 'recurringOrderCreated', 'recurring_order_created'],
      ['recurring-order-paused', 'recurringOrderPaused', 'recurring_order_paused'],
      ['recurring-order-resumed', 'recurringOrderResumed', 'recurring_order_resumed'],
      ['recurring-order-skipped', 'recurringOrderSkipped', 'recurring_order_skipped'],
      ['recurring-order-cancelled', 'recurringOrderCancelled', 'recurring_order_cancelled'],
      ['recurring-order-generated', 'recurringOrderGenerated', 'recurring_order_generated'],
      ['recurring-order-updated', 'recurringOrderUpdated', 'recurring_order_updated'],
    ] as const).map(([event, setting, fallback]) => [
      event,
      (data: Record<string, unknown>, s: KapsoSettings) => ({
        name: s.templates[setting] ?? fallback,
        language: { code: s.templateLang },
        components: bodyParams(
          data.customer_name ?? '',
          data.recurring_order_id ?? '',
          data.next_execution ?? '',
        ),
      }),
    ]),
  ),
  'recurring-renewal-ready': (data, s) => ({
    name: s.templates.recurringRenewalReady ?? 'recurring_renewal_ready',
    language: { code: s.templateLang },
    components: bodyParams(
      data.customer_name ?? '',
      data.total ?? '',
      data.confirmation_url ?? '',
    ),
  }),
  'recurring-renewal-upcoming': (data, s) => ({
    name:
      s.templates.recurringRenewalUpcoming ?? 'recurring_renewal_upcoming',
    language: { code: s.templateLang },
    components: bodyParams(
      data.customer_name ?? '',
      data.total ?? '',
      data.frequency_label ?? '',
    ),
  }),
  'recurring-renewal-reminder': (data, s) => ({
    name:
      s.templates.recurringRenewalReminder ?? 'recurring_renewal_reminder',
    language: { code: s.templateLang },
    components: bodyParams(data.customer_name ?? '', data.confirmation_url ?? ''),
  }),
  'recurring-order-failed': (data, s) => ({
    name: s.templates.recurringOrderFailed ?? 'recurring_order_failed',
    language: { code: s.templateLang },
    components: bodyParams(data.customer_name ?? '', data.frequency_label ?? ''),
  }),
  'recurring-stock-unavailable': (data, s) => ({
    name:
      s.templates.recurringStockUnavailable ?? 'recurring_stock_unavailable',
    language: { code: s.templateLang },
    components: bodyParams(data.recurring_order_id ?? '', data.cycle_id ?? ''),
  }),
  'recurring-stock-skipped': (data, s) => ({
    name: s.templates.recurringStockSkipped ?? 'recurring_stock_skipped',
    language: { code: s.templateLang },
    components: bodyParams(data.recurring_order_id ?? '', data.cycle_id ?? ''),
  }),
  'recurring-payment-failed': (data, s) => ({
    name: s.templates.recurringPaymentFailed ?? 'recurring_payment_failed',
    language: { code: s.templateLang },
    components: bodyParams(
      data.recurring_order_id ?? '',
      data.cycle_id ?? '',
      data.manage_url ?? '',
    ),
  }),
};
