/**
 * Email events catalog — the single source of truth for the email-templates
 * extension. It drives THREE things that must always agree:
 *
 *  1. The `key` dropdown options in the admin (curated, common events only —
 *     no raw Medusa `entity.action` event firehose).
 *  2. What the seed script pre-builds (one template row per `key` below).
 *  3. How the editor groups templates into Usuario/Admin tabs and how the
 *     test-send modal decides whether to ask for one or two recipients.
 *
 * A "logical event" (e.g. registering a company) can notify TWO audiences with
 * TWO separate template rows (distinct keys, e.g. `company-register` +
 * `company-register-admin`). We model audience as a separate ROW (not a column)
 * so the send path stays keyed by `key` — see the email provider. The link
 * between the two rows is `metadata.event` (+ `metadata.audience`), set by the
 * seed and read by the UI.
 *
 * This file is PURE DATA (no server-only imports) so it is safe to import from
 * both the backend (seed, provider) and the admin bundle.
 */

export type EmailAudience = 'user' | 'admin';

export interface EmailEventTemplate {
  /** Template `key` — what `createNotifications({ template })` is called with. */
  key: string;
  audience: EmailAudience;
  /** Short label for the tab / option (e.g. "Usuario", "Admin"). */
  audienceLabel: string;
  /** Human label shown in the key dropdown. */
  label: string;
}

export interface EmailEvent {
  /** Logical event id — stored in `template.metadata.event` to group rows. */
  event: string;
  /** Human label for the event group (list grouping + tab strip heading). */
  label: string;
  /**
   * `true` when this event is dispatched by a subscriber/route in this repo
   * today (so a published template actually fires). `false` = selectable and
   * seedable, but no wiring yet.
   */
  wired: boolean;
  templates: EmailEventTemplate[];
}

const USER = (key: string, label: string): EmailEventTemplate => ({
  key,
  audience: 'user',
  audienceLabel: 'Usuario',
  label,
});

const ADMIN = (key: string, label: string): EmailEventTemplate => ({
  key,
  audience: 'admin',
  audienceLabel: 'Admin',
  label,
});

/**
 * Curated catalog. Order here is the order shown in the admin list and dropdown.
 */
export const EMAIL_EVENTS: EmailEvent[] = [
  {
    event: 'order-placed',
    label: 'Orden creada',
    wired: true,
    templates: [
      USER('order-confirmation', 'Confirmación de pedido (usuario)'),
      ADMIN('order-notification-admin', 'Notificación de pedido (admin)'),
    ],
  },
  {
    /**
     * Retiro en tienda: el pedido ya está preparado en el local.
     *
     * `wired: true` — lo dispara una acción HUMANA, no un evento de orden: el
     * botón "Marcar listo para retirar" del detalle de la orden, o mover la
     * ejecución de entrega a `at_pickup_point`. Las dos puertas pasan por
     * `markOrderReadyForPickup`, que gatea con `order.metadata.ready_for_pickup_at`
     * para que el cliente reciba el aviso una sola vez.
     */
    event: 'order-ready-for-pickup',
    label: 'Pedido listo para retirar',
    wired: true,
    templates: [
      USER('order-ready-for-pickup', 'Pedido listo para retirar (usuario)'),
    ],
  },
  {
    event: 'customer-register',
    label: 'Registro de cliente',
    wired: true,
    templates: [USER('customer-register', 'Registro de cliente')],
  },
  {
    event: 'cart-abandoned',
    label: 'Carrito abandonado',
    wired: true,
    templates: [
      USER('cart-abandoned-1', 'Carrito abandonado · paso 1 (1h)'),
      USER('cart-abandoned-2', 'Carrito abandonado · paso 2 (24h)'),
      USER('cart-abandoned-3', 'Carrito abandonado · paso 3 (72h)'),
    ],
  },
  {
    event: 'recurring-order',
    label: 'Compras recurrentes',
    wired: true,
    templates: [
      USER('recurring-order-created', 'Compra recurrente · alta'),
      USER('recurring-renewal-ready', 'Compra recurrente · lista para confirmar'),
      USER('recurring-renewal-reminder', 'Compra recurrente · recordatorio de pago'),
      USER('recurring-order-generated', 'Compra recurrente · pedido generado'),
      USER('recurring-order-paused', 'Compra recurrente · pausada'),
      USER('recurring-order-resumed', 'Suscripción · reanudada'),
      USER('recurring-order-skipped', 'Suscripción · entrega omitida'),
      USER('recurring-order-updated', 'Suscripción · datos actualizados'),
      USER('recurring-order-cancelled', 'Compra recurrente · cancelada'),
      USER('recurring-order-failed', 'Compra recurrente · requiere atención'),
      USER('recurring-renewal-upcoming', 'Suscripción · próximo cobro automático'),
      USER('recurring-stock-unavailable', 'Suscripción · esperando stock'),
      USER('recurring-stock-skipped', 'Suscripción · ciclo omitido por stock'),
      USER('recurring-payment-failed', 'Suscripción · cobro rechazado'),
      ADMIN('recurring-stock-alert', 'Suscripción · alerta de stock'),
    ],
  },
  {
    event: 'company-register',
    label: 'Registro de empresa',
    wired: true,
    templates: [
      USER('company-register', 'Registro de empresa (usuario)'),
      ADMIN('company-register-admin', 'Registro de empresa (admin)'),
    ],
  },
  {
    event: 'corporate-register',
    label: 'Solicitud de registro corporativo',
    wired: true,
    templates: [
      USER('corporate-register', 'Solicitud corporativa recibida (usuario)'),
      ADMIN('corporate-register-admin', 'Solicitud corporativa (admin)'),
    ],
  },
  {
    event: 'corporate-approved',
    label: 'Cuenta corporativa aprobada',
    wired: true,
    templates: [USER('b2b-client-approved', 'Cliente B2B aprobado')],
  },
  {
    event: 'contact',
    label: 'Formulario de contacto',
    wired: true,
    templates: [
      USER('contact-received', 'Acuse de contacto (usuario)'),
      ADMIN('contact-notification-admin', 'Nuevo contacto (admin)'),
    ],
  },
  {
    event: 'company-invite',
    label: 'Invitación a empresa',
    wired: true,
    templates: [USER('company-invite', 'Invitación a empresa')],
  },
  {
    event: 'corporate-invite',
    label: 'Invitación corporativa',
    wired: true,
    templates: [USER('corporate-invite', 'Invitación corporativa')],
  },
  // `gift-card-issued` SALIÓ de acá (2026-09-03). Estaba con `wired: true` y no
  // existía como emisor en ninguna parte del repo: el único lugar del código que
  // la nombraba era este catálogo (más su reflejo inerte en `KEY_META` del seed y
  // su excepción en `template-variables.test.ts`). El plugin de gift cards emite
  // `gift-card-delivery`, `gift-card-resend`, `gift-card-delivery-failed-buyer`,
  // `gift-card-expiring` y `gift-card-balance-reminder` — o sea que el
  // desplegable ofrecía exactamente la clave equivocada.
  //
  // Se BORRA en vez de reemplazarla por las cinco reales a propósito: el plugin
  // es opcional, y ofrecer en el admin de toda instalación cinco claves que sólo
  // dispara un plugin que puede no estar instalado es la misma fábrica de
  // plantillas muertas, multiplicada por cinco. Cablearlas es una decisión
  // aparte, y viene con los diseños del seed.
  {
    event: 'order-invoice',
    label: 'Comprobante disponible',
    // Cableado: lo dispara `erp.invoice_ready`, que emite el poll del
    // comprobante cuando el ERP termina de facturar.
    wired: true,
    templates: [USER('order-invoice', 'Comprobante disponible')],
  },
  {
    event: 'password-reset',
    label: 'Restablecer contraseña',
    // SUBIÓ de la sección de abajo (2026-09-03): estaba con `wired: false` y era
    // falso. Lo dispara `subscribers/password-reset-email.ts` con
    // `channel: 'email'` desde `auth.password_reset`, y en desdeelsur salieron 8
    // reseteos por esta clave contra una fila publicada. El `false` desanima al
    // operador de editar una plantilla que SÍ se usa — y encima es de las que el
    // cliente ve en el peor momento.
    wired: true,
    templates: [USER('password-reset', 'Restablecer contraseña')],
  },
  {
    event: 'order-transfer-request',
    label: 'Vincular pedido a una cuenta',
    // Cableado desde el arranque: lo dispara
    // `subscribers/order-transfer-requested-email.ts` sobre
    // `order.transfer_requested`, el evento del flujo de transferencia del core.
    // Nace en `true` justamente porque el bug que lo trae (DESDEELSUR-61) era el
    // inverso: el flujo entero existía y el mail no lo mandaba nadie.
    wired: true,
    templates: [USER('order-transfer-request', 'Vincular pedido a una cuenta')],
  },
  {
    event: 'order-tracking',
    label: 'Seguimiento de envío',
    // SUBIÓ de la sección de abajo (2026-09-17). Estuvo en `false` porque era
    // cierto: la plantilla existía completa y editable, y sus dos únicos emisores
    // mandaban por `whatsapp`. El QA de DESDEELSUR-39 lo encontró desde el otro
    // lado — todos los mails con subscriber llegaron, y los únicos dos que no
    // llegaron fueron "en camino" y "entregado", que eran los únicos sin emisor.
    //
    // Ahora la emiten por mail `subscribers/order-delivered-email.ts` (entregado)
    // y los tres de "en camino", uno por extensión de logística:
    // `andreani-ticket-tracking-email.ts`, `correo-ticket-tracking-email.ts` y
    // `own-fleet-delivery-email.ts`.
    wired: true,
    templates: [USER('order-tracking', 'Seguimiento de envío')],
  },
  // ── Conocidos pero sin wiring nuevo en esta entrega (seleccionables/seedables) ──
  {
    event: 'order-cancelled',
    label: 'Pedido cancelado',
    // `subscribers/order-cancelled-email.ts` la dispara en `order.canceled`. Estuvo
    // en `false` mientras la fila existia publicada y sin un solo emisor de mail:
    // el admin la mostraba igual, que es como el agujero paso desapercibido.
    wired: true,
    templates: [USER('order-cancelled', 'Pedido cancelado')],
  },
  {
    event: 'quotation',
    label: 'Cotizaciones',
    wired: false,
    templates: [
      ADMIN('quotation-notification-admin', 'Cotización generada (admin)'),
      ADMIN('quotation-rejected-admin', 'Cotización rechazada (admin)'),
    ],
  },
  {
    event: 'operational',
    label: 'Operacionales',
    wired: false,
    templates: [
      ADMIN('kit-cde-notification', 'Kit para preparar (CDE)'),
      ADMIN('stock-sync-report', 'Reporte de sync de stock'),
    ],
  },
];

// ─── Derived lookups ──────────────────────────────────────────────────────────

export interface EmailKeyOption {
  value: string;
  label: string;
  /** Logical event group label, for optional grouping in the UI. */
  group: string;
}

/** Flat list of all template keys for the `key` dropdown (curated). */
export const EMAIL_TEMPLATE_KEY_OPTIONS: EmailKeyOption[] = EMAIL_EVENTS.flatMap(
  (ev) =>
    ev.templates.map((tpl) => ({
      value: tpl.key,
      label: tpl.label,
      group: ev.label,
    })),
);

const KEY_INDEX: Record<
  string,
  { event: EmailEvent; template: EmailEventTemplate }
> = {};
for (const event of EMAIL_EVENTS) {
  for (const template of event.templates) {
    KEY_INDEX[template.key] = { event, template };
  }
}

/** Returns the logical event + audience info for a template key, or null. */
export function findByKey(key: string) {
  return KEY_INDEX[key] ?? null;
}

/** Returns every template (key + audience) that belongs to the same event. */
export function getEventTemplatesForKey(key: string): EmailEventTemplate[] {
  return KEY_INDEX[key]?.event.templates ?? [];
}

/** True when the key's logical event notifies more than one audience. */
export function isDualAudience(key: string): boolean {
  return getEventTemplatesForKey(key).length > 1;
}

/** The logical event id (`metadata.event`) for a key, or null. */
export function eventIdForKey(key: string): string | null {
  return KEY_INDEX[key]?.event.event ?? null;
}

/** The audience (`metadata.audience`) for a key, or null. */
export function audienceForKey(key: string): EmailAudience | null {
  return KEY_INDEX[key]?.template.audience ?? null;
}
