import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { getWaOrderStatus, type WaOrderStatus } from './order-status';

/**
 * Consulta de pedidos para el cliente (PRD §20), en los dos caminos:
 *
 * - **Identificado por teléfono**: se muestran sus pedidos recientes.
 * - **No identificado**: NO se muestra nada sin validar. Se pide número de pedido
 *   + email y sólo se responde si los dos coinciden con el mismo pedido. Es el
 *   requisito §28 de no exponer datos de otros clientes: con el número solo,
 *   cualquiera podría leer el pedido de otra persona probando números.
 */

const STATUS_LABELS: Record<string, string> = {
  pending: 'pendiente',
  completed: 'completado',
  canceled: 'cancelado',
  requires_action: 'requiere acción',
  draft: 'borrador',
  archived: 'archivado',
  not_paid: 'sin pagar',
  awaiting: 'esperando pago',
  authorized: 'autorizado',
  partially_authorized: 'parcialmente autorizado',
  captured: 'pagado',
  partially_captured: 'parcialmente pagado',
  refunded: 'reintegrado',
  partially_refunded: 'parcialmente reintegrado',
  not_fulfilled: 'en preparación',
  partially_fulfilled: 'parcialmente preparado',
  fulfilled: 'preparado',
  partially_shipped: 'parcialmente despachado',
  shipped: 'despachado',
  delivered: 'entregado',
  partially_delivered: 'parcialmente entregado',
  canceled_fulfillment: 'preparación cancelada',
};

const label = (value: string | null | undefined): string | null =>
  value ? (STATUS_LABELS[value] ?? value.replace(/_/g, ' ')) : null;

/**
 * Estado del pedido en castellano y para el CLIENTE (no para el prompt): sin
 * jerga de Medusa y sin campos internos. `formatOrderStatusForPrompt` sigue
 * existiendo para lo que se le inyecta al modelo.
 */
export function formatOrderStatusForCustomer(s: WaOrderStatus): string {
  const lines: string[] = [`*Pedido #${s.display_id ?? '—'}*`];
  const payment = label(s.payment_status);
  const fulfillment = label(s.fulfillment_status);
  if (payment) lines.push(`Pago: ${payment}`);
  if (fulfillment) lines.push(`Preparación: ${fulfillment}`);
  if (s.shipping_method) lines.push(`Entrega: ${s.shipping_method}`);
  if (s.total) lines.push(`Total: $${s.total} ${s.currency_code ?? ''}`.trim());
  if (s.delivered_at) lines.push('Ya fue entregado ✅');
  else if (s.shipped_at) lines.push('Ya salió para entrega 🚚');
  for (const t of s.tracking) {
    lines.push(`Seguimiento: ${t.number}${t.url ? `\n${t.url}` : ''}`);
  }
  return lines.join('\n');
}

/** Pedidos recientes de un cliente ya identificado, listos para mandar. */
export async function formatCustomerOrders(
  container: MedusaContainer,
  orderIds: string[],
): Promise<string> {
  const blocks: string[] = [];
  for (const orderId of orderIds) {
    const status = await getWaOrderStatus(container, orderId);
    if (status) blocks.push(formatOrderStatusForCustomer(status));
  }
  if (blocks.length === 0) return 'No encontré pedidos asociados a este número.';
  return blocks.join('\n\n');
}

/** Extrae el número de pedido de un texto libre ("el 1234", "pedido #1234"). */
export function parseOrderDisplayId(text: string): number | null {
  const match = /(\d{1,10})/.exec(text.replace(/[#\s]/g, ' '));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export function parseEmail(text: string): string | null {
  const match = EMAIL_RE.exec(text.trim());
  return match ? match[0].toLowerCase() : null;
}

/**
 * Busca un pedido por número Y email. Devuelve el estado sólo si los dos
 * coinciden; si no, `null` — y el llamador responde lo MISMO tanto si el pedido
 * no existe como si el email no coincide, para no confirmar la existencia de un
 * pedido ajeno.
 */
export async function lookupOrderByDisplayIdAndEmail(
  container: MedusaContainer,
  displayId: number,
  email: string,
): Promise<WaOrderStatus | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: orders } = await query.graph({
    entity: 'order',
    fields: ['id', 'display_id', 'email'],
    filters: { display_id: displayId },
  });
  const wanted = email.trim().toLowerCase();
  const match = (orders ?? []).find(
    (o: any) => typeof o?.email === 'string' && o.email.trim().toLowerCase() === wanted,
  );
  if (!match) return null;
  return getWaOrderStatus(container, match.id as string);
}
