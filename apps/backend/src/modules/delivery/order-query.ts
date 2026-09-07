/**
 * order-query — derivación del agregado de la orden de una DeliveryExecution
 * vía query.graph (I/O), separada del agregado PURO de ./order-context.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE (causa raíz del bug que arregla):
 *   El container de un MÓDULO en Medusa v2 está AISLADO y NO tiene registrado
 *   `query` (ContainerRegistrationKeys.QUERY). query.graph cruza módulos vía los
 *   links y SOLO existe en el container principal (workflows, API routes,
 *   subscribers). Por eso el service del módulo delivery NO puede resolver QUERY
 *   desde su propio __container__ — fallaba en runtime al auto-asignar.
 *
 *   La solución: el query.graph que lee la orden se hace en los CALL SITES (que
 *   sí tienen `query` en su container) usando este helper, y al service se le
 *   pasa el agregado YA computado. Este helper hace I/O, por eso vive aparte de
 *   order-context.ts (que es puro y testeable en aislamiento).
 */

import { buildOrderItemsAggregate } from './order-context';
import type { TemperatureMode } from './types';

/**
 * Tipo estructural mínimo del `query` resuelto vía
 * container.resolve(ContainerRegistrationKeys.QUERY). Solo necesitamos
 * `graph`. Se tipa estructuralmente (no vía un type exportado de Medusa) para
 * no acoplarnos a la superficie interna del framework; el caller le pasa el
 * query real del container, que es compatible.
 */
export interface GraphQuery {
  graph: (config: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }) => Promise<{ data: unknown[] }>;
}

/** Agregado de la orden que consume getEligibleResources del service. */
export interface ExecutionOrderAggregate {
  weight_kg: number | null;
  item_count: number;
  temperature: TemperatureMode;
  volume_m3: number | null;
}

/**
 * Lee la orden linkeada a una DeliveryExecution (vía query.graph por el link) y
 * deriva el agregado de flota: peso, conteo y temperatura (reusando el agregado
 * puro buildOrderItemsAggregate) + volumen (de shipping_address.metadata).
 *
 * @param query  El `query` resuelto del container del caller (workflow / route /
 *               subscriber). El container de un módulo NO sirve acá.
 * @param executionId  La DeliveryExecution a la que está linkeada la orden.
 */
export async function fetchExecutionOrderAggregate(
  query: GraphQuery,
  executionId: string,
): Promise<ExecutionOrderAggregate> {
  const { data: executions } = await query.graph({
    entity: 'delivery_execution',
    fields: [
      'id',
      'order.id',
      'order.shipping_address.metadata',
      'order.items.quantity',
      'order.items.variant_sku',
      'order.items.variant.sku',
      'order.items.variant.weight',
      'order.items.product.weight',
      'order.items.variant.metadata',
      'order.items.product.metadata',
    ],
    filters: { id: executionId },
  });

  const row = (executions?.[0] ?? {}) as Record<string, unknown>;
  const order =
    row.order && typeof row.order === 'object'
      ? (row.order as Record<string, unknown>)
      : undefined;
  const items = Array.isArray(order?.items)
    ? (order!.items as unknown[])
    : [];
  const aggregate = buildOrderItemsAggregate(items);

  // Volumen: opcional, desde shipping_address.metadata.volume_m3 si el
  // storefront lo capturó. Sin él, null → no filtra por volumen.
  let volumeM3: number | null = null;
  const shippingAddress =
    order && typeof order.shipping_address === 'object' && order.shipping_address
      ? (order.shipping_address as Record<string, unknown>)
      : undefined;
  const addrMeta =
    shippingAddress && typeof shippingAddress.metadata === 'object' && shippingAddress.metadata
      ? (shippingAddress.metadata as Record<string, unknown>)
      : undefined;
  const rawVolume = addrMeta?.volume_m3;
  if (typeof rawVolume === 'number' && Number.isFinite(rawVolume)) {
    volumeM3 = rawVolume;
  } else if (typeof rawVolume === 'string' && rawVolume.trim() !== '') {
    const parsed = Number(rawVolume);
    if (Number.isFinite(parsed)) volumeM3 = parsed;
  }

  return {
    weight_kg: aggregate.weight_kg,
    item_count: aggregate.item_count,
    temperature: aggregate.temperature,
    volume_m3: volumeM3,
  };
}
