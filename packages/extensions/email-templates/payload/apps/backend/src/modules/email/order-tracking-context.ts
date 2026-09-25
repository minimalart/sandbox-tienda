import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';
import type { MedusaContainer } from '@medusajs/framework/types';
import type {
  OrderTrackingData,
  TrackingMilestone,
  TrackingTimelineStep,
} from './templates/order-tracking';

/**
 * El emisor de la plantilla `order-tracking` POR MAIL.
 *
 * ── POR QUÉ ESTE ARCHIVO EXISTE ─────────────────────────────────────────────
 *
 * La plantilla estaba completa —hitos, copy, iconos, hasta `delivered-icon.png`—
 * y editable en el admin desde hacía meses, pero **ningún subscriber la emitía
 * por el canal `email`**. Sus dos únicos emisores eran los de WhatsApp de
 * Andreani y Correo. El QA de Belén sobre DESDEELSUR-39 lo dejó a la vista sin
 * proponérselo (2026-09-14 y 2026-09-17): validó en verde creación de cuenta,
 * reseteo, contacto, compra, carrito abandonado, retiro en tienda y "listo para
 * entregar" —todos los que SÍ tienen subscriber de mail— y marcó en rojo
 * exactamente los dos que no lo tenían: "en camino" y "entregado".
 *
 * ── DE DÓNDE SALE CADA COSA ─────────────────────────────────────────────────
 *
 * El branding (`logo_url`, `primary_color`, `cde_display_name`) NO se arma acá:
 * lo resuelve el módulo de email al renderizar, con la misma pista de tienda que
 * el resto de los mails. Acá se arma lo que sólo se sabe en el momento del
 * evento: el hito, la línea de tiempo y el tracking.
 *
 * ── EL HITO NO ES OPCIONAL ──────────────────────────────────────────────────
 *
 * `orderTrackingTemplate` cae a `payment_confirmed` cuando no le mandan
 * `current_milestone`. O sea que cablear el mail sin construir el hito haría que
 * el aviso de "entregado" dijera "¡Pago confirmado!". Por eso este helper lo
 * EXIGE en su firma en vez de aceptarlo opcional.
 */

/**
 * Los cinco pasos del storefront, en su orden y con sus iconos
 * (`modules/order/templates/order-details-template.tsx`). Se replican acá —y no
 * se importan— porque aquello es un componente de React del otro app: lo que se
 * comparte es el CONTRATO de la línea de tiempo, no el archivo.
 */
const TIMELINE: ReadonlyArray<{ label: string; icon: TrackingTimelineStep['icon'] }> = [
  { label: 'Pedido realizado', icon: 'dollar' },
  { label: 'Pago confirmado', icon: 'dollar' },
  { label: 'En preparación', icon: 'package' },
  { label: 'Enviado', icon: 'truck' },
  { label: 'Entregado', icon: 'pin' },
];

/** Índice del hito dentro de `TIMELINE`. */
const MILESTONE_INDEX: Partial<Record<TrackingMilestone, number>> = {
  payment_confirmed: 1,
  in_preparation: 2,
  shipped: 3,
  delivered: 4,
};

export type TrackingEventDates = {
  /** `order.created_at`. Fecha del paso 0. */
  placed_at?: string | null;
  /** Cuándo ocurrió el hito que dispara este mail. Default: ahora. */
  milestone_at?: string | null;
};

/**
 * Marca como cumplidos los pasos hasta el hito y deja el resto pendientes.
 *
 * Sólo se fechan los dos pasos que se conocen de verdad —el alta de la orden y
 * el hito de este mail—. Inventar fechas para los intermedios sería peor que
 * dejarlos sin fecha: la plantilla los muestra tal cual y el cliente los lee
 * como si hubieran pasado en ese momento.
 */
export function buildTrackingTimeline(
  milestone: TrackingMilestone,
  dates: TrackingEventDates = {},
): TrackingTimelineStep[] {
  const current = MILESTONE_INDEX[milestone] ?? 0;
  return TIMELINE.map((step, index) => ({
    index,
    label: step.label,
    icon: step.icon,
    done: index <= current,
    date_iso:
      index === 0
        ? (dates.placed_at ?? null)
        : index === current
          ? (dates.milestone_at ?? new Date().toISOString())
          : null,
  }));
}

type TrackingOrder = {
  id: string;
  display_id?: number | null;
  created_at?: string | Date | null;
  email?: string | null;
  sales_channel_id?: string | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
  shipping_address?: {
    first_name?: string | null;
    last_name?: string | null;
    address_1?: string | null;
    address_2?: string | null;
    city?: string | null;
    postal_code?: string | null;
    province?: string | null;
  } | null;
};

const asIso = (value?: string | Date | null): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Los campos de `query.graph` que este mail necesita, para no duplicarlos en cada emisor. */
export const ORDER_TRACKING_FIELDS = [
  'id',
  'display_id',
  'created_at',
  'email',
  'sales_channel_id',
  'customer.first_name',
  'customer.last_name',
  'shipping_address.first_name',
  'shipping_address.last_name',
  'shipping_address.address_1',
  'shipping_address.address_2',
  'shipping_address.city',
  'shipping_address.postal_code',
  'shipping_address.province',
];

export function buildOrderTrackingData(
  order: TrackingOrder,
  input: {
    milestone: TrackingMilestone;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    milestoneAt?: string | null;
  },
): OrderTrackingData {
  const customerName = [order.customer?.first_name, order.customer?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    order_id: order.id,
    display_id: order.display_id ?? undefined,
    sales_channel_id: order.sales_channel_id ?? undefined,
    customer_email: order.email ?? undefined,
    customer_name: customerName || undefined,
    current_milestone: input.milestone,
    timeline_steps: buildTrackingTimeline(input.milestone, {
      placed_at: asIso(order.created_at),
      milestone_at: input.milestoneAt ?? new Date().toISOString(),
    }),
    shipping_address: order.shipping_address
      ? {
          first_name: order.shipping_address.first_name ?? undefined,
          last_name: order.shipping_address.last_name ?? undefined,
          address_1: order.shipping_address.address_1 ?? undefined,
          address_2: order.shipping_address.address_2 ?? undefined,
          city: order.shipping_address.city ?? undefined,
          postal_code: order.shipping_address.postal_code ?? undefined,
          province: order.shipping_address.province ?? undefined,
        }
      : null,
    // Sólo viajan cuando el emisor los sabe. La plantilla no los exige y un
    // pedido de retiro en tienda no tiene ninguno de los dos.
    tracking_number: input.trackingNumber ?? undefined,
    tracking_url: input.trackingUrl ?? undefined,
  };
}

/**
 * Manda el mail de seguimiento. NUNCA propaga: el event bus corre con
 * `concurrency: 1` y un subscriber que lanza congela la cola de notificaciones
 * de toda la instalación hasta el próximo reinicio.
 */
export async function sendOrderTrackingEmail(
  container: MedusaContainer,
  input: {
    orderId: string;
    milestone: TrackingMilestone;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    milestoneAt?: string | null;
    /** Prefijo del log, para saber qué emisor falló sin abrir el código. */
    source: string;
  },
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: orders } = (await query.graph({
      entity: 'order',
      fields: ORDER_TRACKING_FIELDS,
      filters: { id: input.orderId },
    })) as { data: TrackingOrder[] };

    const order = orders?.[0];
    if (!order) {
      logger.warn(`[${input.source}] No se encontró la orden ${input.orderId} — no se manda el mail.`);
      return;
    }
    if (!order.email) {
      logger.warn(`[${input.source}] La orden ${input.orderId} no tiene email — no se manda el mail.`);
      return;
    }

    const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
    await notificationService.createNotifications({
      to: order.email,
      channel: 'email',
      template: 'order-tracking',
      data: {
        ...buildOrderTrackingData(order, input),
        recipient_type: 'customer',
      },
    });
  } catch (error) {
    logger.warn(
      `[${input.source}] No se pudo mandar el mail de seguimiento de la orden ${input.orderId}: ${
        (error as Error).message
      }`,
    );
  }
}
