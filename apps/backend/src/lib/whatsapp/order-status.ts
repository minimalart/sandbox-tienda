import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { buildAndreaniTrackingUrl } from '../../modules/andreani-fulfillment/utils/tracking-url';

export type WaOrderStatus = {
  display_id: number | null;
  status: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  created_at: string | null;
  total: string | null;
  currency_code: string | null;
  shipping_method: string | null;
  tracking: Array<{ number: string; url: string | null }>;
  shipped_at: string | null;
  delivered_at: string | null;
};

function formatMoney(amount: number | null | undefined): string | null {
  if (amount == null) return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(d);
}

/**
 * Trae el estado + tracking de un pedido para armar el contexto que se le inyecta
 * al agente de WhatsApp. La consulta de tracking (fulfillments/labels) va aparte
 * y protegida: si falla, se devuelve igual el estado base (nunca rompe la respuesta).
 */
export async function getWaOrderStatus(
  container: MedusaContainer,
  orderId: string,
): Promise<WaOrderStatus | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: orders } = await query.graph({
    entity: 'order',
    fields: [
      'id',
      'display_id',
      'status',
      'payment_status',
      'fulfillment_status',
      'created_at',
      'total',
      'currency_code',
      'shipping_methods.name',
    ],
    filters: { id: orderId },
  });
  const order = orders?.[0];
  if (!order) return null;

  const tracking: WaOrderStatus['tracking'] = [];
  let shipped_at: string | null = null;
  let delivered_at: string | null = null;
  try {
    const { data: withFul } = await query.graph({
      entity: 'order',
      fields: [
        'id',
        'fulfillments.shipped_at',
        'fulfillments.delivered_at',
        'fulfillments.labels.tracking_number',
        'fulfillments.labels.tracking_url',
      ],
      filters: { id: orderId },
    });
    const fulfillments = (withFul?.[0]?.fulfillments ?? []) as any[];
    for (const f of fulfillments) {
      if (f?.shipped_at && !shipped_at) shipped_at = f.shipped_at;
      if (f?.delivered_at && !delivered_at) delivered_at = f.delivered_at;
      for (const label of (f?.labels ?? []) as any[]) {
        const number = label?.tracking_number;
        if (!number) continue;
        tracking.push({
          number,
          url: label?.tracking_url || buildAndreaniTrackingUrl(number) || null,
        });
      }
    }
  } catch {
    // El esquema de fulfillment/labels no está disponible o cambió: seguimos con
    // el estado base sin tracking.
  }

  return {
    display_id: order.display_id ?? null,
    status: order.status ?? null,
    payment_status: order.payment_status ?? null,
    fulfillment_status: order.fulfillment_status ?? null,
    created_at: order.created_at ?? null,
    total: formatMoney(order.total),
    currency_code: order.currency_code?.toUpperCase() ?? null,
    shipping_method: order.shipping_methods?.[0]?.name ?? null,
    tracking,
    shipped_at,
    delivered_at,
  };
}

/** Serializa el estado a un bloque de texto compacto para el prompt del agente. */
export function formatOrderStatusForPrompt(s: WaOrderStatus): string {
  const lines: string[] = [];
  lines.push(`Pedido #${s.display_id ?? '—'}`);
  if (s.created_at) lines.push(`Fecha: ${formatDate(s.created_at)}`);
  if (s.status) lines.push(`Estado: ${s.status}`);
  if (s.payment_status) lines.push(`Pago: ${s.payment_status}`);
  if (s.fulfillment_status) lines.push(`Envío: ${s.fulfillment_status}`);
  if (s.shipping_method) lines.push(`Método de envío: ${s.shipping_method}`);
  if (s.total) lines.push(`Total: ${s.total} ${s.currency_code ?? ''}`.trim());
  if (s.shipped_at) lines.push(`Despachado: ${formatDate(s.shipped_at)}`);
  if (s.delivered_at) lines.push(`Entregado: ${formatDate(s.delivered_at)}`);
  for (const t of s.tracking) {
    lines.push(`Seguimiento: ${t.number}${t.url ? ` (${t.url})` : ''}`);
  }
  return lines.join('\n');
}
