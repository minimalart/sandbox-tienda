/**
 * Catálogo de eventos de WhatsApp asignables a un template, con las variables que
 * cada evento expone para mapear a los placeholders {{1}}, {{2}}… del template.
 *
 * IMPORTANTE: estas variables DEBEN coincidir con los campos que el subscriber
 * correspondiente emite en `data` (ver src/subscribers/*-whatsapp.ts). Si acá se
 * ofrece una variable que el subscriber no manda, el parámetro viajaría vacío y
 * Meta rechaza el mensaje.
 *
 * Los labels se resuelven por i18n: `labelKey` es una clave del namespace
 * `whatsapp` (ver src/admin/translations/whatsapp). `key`/`name` son datos
 * técnicos y NO se traducen.
 */

export type WhatsappEventVariable = { name: string; labelKey: string };

export type WhatsappEvent = {
  key: string;
  labelKey: string;
  variables: WhatsappEventVariable[];
};

const ORDER_BASE: WhatsappEventVariable[] = [
  { name: 'customer_name', labelKey: 'VAR_CUSTOMER_NAME' },
  { name: 'display_id', labelKey: 'VAR_DISPLAY_ID' },
  { name: 'total', labelKey: 'VAR_TOTAL' },
  { name: 'currency_code', labelKey: 'VAR_CURRENCY_CODE' },
  { name: 'order_date', labelKey: 'VAR_ORDER_DATE' },
  { name: 'shipping_method_name', labelKey: 'VAR_SHIPPING_METHOD_NAME' },
  { name: 'customer_email', labelKey: 'VAR_CUSTOMER_EMAIL' },
];

export const WHATSAPP_EVENTS: WhatsappEvent[] = [
  {
    key: 'order-confirmation',
    labelKey: 'EVENT_ORDER_CONFIRMATION',
    variables: ORDER_BASE,
  },
  {
    // Seguimiento con tracking real de Andreani (andreani.ticket_generated).
    key: 'order-tracking',
    labelKey: 'EVENT_ORDER_TRACKING',
    variables: [
      { name: 'customer_name', labelKey: 'VAR_CUSTOMER_NAME' },
      { name: 'display_id', labelKey: 'VAR_DISPLAY_ID' },
      { name: 'tracking_number', labelKey: 'VAR_TRACKING_NUMBER' },
      { name: 'tracking_url', labelKey: 'VAR_TRACKING_URL' },
    ],
  },
  {
    // "En camino" de flota propia (delivery.own_fleet_out_for_delivery).
    key: 'order-delivery',
    labelKey: 'EVENT_ORDER_DELIVERY',
    variables: [
      { name: 'customer_name', labelKey: 'VAR_CUSTOMER_NAME' },
      { name: 'display_id', labelKey: 'VAR_DISPLAY_ID' },
      { name: 'driver_name', labelKey: 'VAR_DRIVER_NAME' },
      { name: 'driver_phone', labelKey: 'VAR_DRIVER_PHONE' },
      { name: 'vehicle_type', labelKey: 'VAR_VEHICLE_TYPE' },
    ],
  },
  {
    // Listo para retirar (markOrderReadyForPickup: el botón del widget de la orden
    // o la transición de la entrega a `at_pickup_point`).
    key: 'order-ready-for-pickup',
    labelKey: 'EVENT_ORDER_READY_FOR_PICKUP',
    variables: [
      { name: 'customer_name', labelKey: 'VAR_CUSTOMER_NAME' },
      { name: 'display_id', labelKey: 'VAR_DISPLAY_ID' },
      { name: 'store_name', labelKey: 'VAR_STORE_NAME' },
      { name: 'store_address', labelKey: 'VAR_STORE_ADDRESS' },
    ],
  },
  {
    key: 'order-cancelled',
    labelKey: 'EVENT_ORDER_CANCELLED',
    variables: ORDER_BASE,
  },
  {
    key: 'password-reset',
    labelKey: 'EVENT_PASSWORD_RESET',
    variables: [
      { name: 'customer_name', labelKey: 'VAR_CUSTOMER_NAME' },
      { name: 'reset_url', labelKey: 'VAR_RESET_URL' },
      { name: 'customer_email', labelKey: 'VAR_CUSTOMER_EMAIL' },
    ],
  },
  // Recuperación de carrito — MARKETING. Un evento por paso de la secuencia;
  // comparten variables (nombre, total, link). Deben coincidir con los `data`
  // del workflow notify-abandoned-cart y los builders de kapso-whatsapp.
  ...(['1', '2', '3'] as const).map((n) => ({
    key: `cart-abandoned-${n}`,
    labelKey: `EVENT_CART_ABANDONED_${n}` as const,
    variables: [
      { name: 'customer_name', labelKey: 'VAR_CUSTOMER_NAME' },
      { name: 'total', labelKey: 'VAR_TOTAL' },
      { name: 'recovery_url', labelKey: 'VAR_RECOVERY_URL' },
    ],
  })),
  // Compras recurrentes — deben coincidir con los `data` que emiten el workflow
  // process-renewal-cycle y el job process-recurring-renewals.
  ...([
    ['recurring-order-created', 'EVENT_RECURRING_ORDER_CREATED'],
    ['recurring-order-paused', 'EVENT_RECURRING_ORDER_PAUSED'],
    ['recurring-order-resumed', 'EVENT_RECURRING_ORDER_RESUMED'],
    ['recurring-order-skipped', 'EVENT_RECURRING_ORDER_SKIPPED'],
    ['recurring-order-cancelled', 'EVENT_RECURRING_ORDER_CANCELLED'],
    ['recurring-order-generated', 'EVENT_RECURRING_ORDER_GENERATED'],
    ['recurring-order-updated', 'EVENT_RECURRING_ORDER_UPDATED'],
  ] as const).map(([key, labelKey]) => ({
    key,
    labelKey,
    variables: [
      { name: 'customer_name', labelKey: 'VAR_CUSTOMER_NAME' },
      { name: 'recurring_order_id', labelKey: 'VAR_RECURRING_ORDER_ID' },
      { name: 'next_execution', labelKey: 'VAR_NEXT_EXECUTION' },
    ],
  })),
  {
    key: 'recurring-renewal-ready',
    labelKey: 'EVENT_RECURRING_RENEWAL_READY',
    variables: [
      { name: 'customer_name', labelKey: 'VAR_CUSTOMER_NAME' },
      { name: 'total', labelKey: 'VAR_TOTAL' },
      { name: 'confirmation_url', labelKey: 'VAR_CONFIRMATION_URL' },
    ],
  },
  {
    key: 'recurring-renewal-upcoming',
    labelKey: 'EVENT_RECURRING_RENEWAL_UPCOMING',
    variables: [
      { name: 'customer_name', labelKey: 'VAR_CUSTOMER_NAME' },
      { name: 'total', labelKey: 'VAR_TOTAL' },
      { name: 'frequency_label', labelKey: 'VAR_FREQUENCY_LABEL' },
    ],
  },
  {
    key: 'recurring-renewal-reminder',
    labelKey: 'EVENT_RECURRING_RENEWAL_REMINDER',
    variables: [
      { name: 'customer_name', labelKey: 'VAR_CUSTOMER_NAME' },
      { name: 'confirmation_url', labelKey: 'VAR_CONFIRMATION_URL' },
    ],
  },
  {
    key: 'recurring-order-failed',
    labelKey: 'EVENT_RECURRING_ORDER_FAILED',
    variables: [
      { name: 'customer_name', labelKey: 'VAR_CUSTOMER_NAME' },
      { name: 'frequency_label', labelKey: 'VAR_FREQUENCY_LABEL' },
    ],
  },
  ...([
    ['recurring-stock-unavailable', 'EVENT_RECURRING_STOCK_UNAVAILABLE'],
    ['recurring-stock-skipped', 'EVENT_RECURRING_STOCK_SKIPPED'],
    ['recurring-payment-failed', 'EVENT_RECURRING_PAYMENT_FAILED'],
  ] as const).map(([key, labelKey]) => ({
    key,
    labelKey,
    variables: [
      { name: 'recurring_order_id', labelKey: 'VAR_RECURRING_ORDER_ID' },
      { name: 'cycle_id', labelKey: 'VAR_CYCLE_ID' },
      { name: 'manage_url', labelKey: 'VAR_MANAGE_URL' },
    ],
  })),
];

export const WHATSAPP_EVENT_BY_KEY: Record<string, WhatsappEvent> = Object.fromEntries(
  WHATSAPP_EVENTS.map((e) => [e.key, e]),
);
