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

/**
 * El mismo texto que manda el router cuando no coinciden. Vive acá para que la
 * acción de los recorridos (`wa_lookup_order`) y la prueba del editor digan
 * EXACTAMENTE lo mismo que el camino viejo.
 */
export const ORDER_NOT_FOUND_MESSAGE =
  'No encontré un pedido con ese número y ese email. Revisalo y probá de nuevo, o decime *hablar con alguien* y te ayuda una persona del equipo.';

export type OrderLookupAnswer =
  | { outcome: 'found'; text: string; displayId: number }
  /** Número o email ilegibles: no se llegó a consultar nada. */
  | { outcome: 'invalid'; text: string; field: 'order_number' | 'email' }
  /** No existe O el email no coincide: indistinguibles a propósito (§28). */
  | { outcome: 'not_found'; text: string };

/**
 * Consulta de pedido a partir de lo que el cliente ESCRIBIÓ, lista para mandarle.
 *
 * Recibe el texto crudo de las dos preguntas abiertas del recorrido y no valores ya
 * limpios: en un recorrido dibujado no hay modelo que extraiga "el 1234" de "mi
 * pedido es el #1234", y un número ilegible tiene que decir QUÉ corregir en vez de
 * responder "no encontré tu pedido" — que es mentira: no se buscó.
 *
 * La verificación es la de siempre (`lookupOrderByDisplayIdAndEmail`): no se
 * muestra NINGÚN dato del pedido hasta que número y email correspondan a la misma
 * orden. La acción del recorrido y la vista previa del editor pasan las dos por acá.
 */
export async function answerOrderLookup(
  container: MedusaContainer,
  rawOrderNumber: unknown,
  rawEmail: unknown,
): Promise<OrderLookupAnswer> {
  const displayId = parseOrderDisplayId(typeof rawOrderNumber === 'string' ? rawOrderNumber : String(rawOrderNumber ?? ''));
  if (displayId == null) {
    return {
      outcome: 'invalid',
      field: 'order_number',
      text: 'No pude leer el número de pedido. Mandame sólo los números (por ejemplo 1234).',
    };
  }
  const email = parseEmail(typeof rawEmail === 'string' ? rawEmail : '');
  if (!email) {
    return {
      outcome: 'invalid',
      field: 'email',
      text: 'Eso no parece un email. Mandámelo completo (por ejemplo nombre@mail.com).',
    };
  }
  const status = await lookupOrderByDisplayIdAndEmail(container, displayId, email);
  if (!status) return { outcome: 'not_found', text: ORDER_NOT_FOUND_MESSAGE };
  return { outcome: 'found', text: formatOrderStatusForCustomer(status), displayId };
}
