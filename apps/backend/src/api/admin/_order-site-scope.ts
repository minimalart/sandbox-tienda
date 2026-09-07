import type { MedusaRequest } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { siteFromRequest } from '../../lib/multistore/request';

/**
 * Las órdenes de un lote que pertenecen a la tienda activa.
 *
 * Existe porque los dos bulks de carrier —`andreani/tickets/bulk` y
 * `correo-argentino/tickets/bulk`— reciben `order_ids` por BODY y crean envíos
 * REALES Y FACTURABLES con ellos. Es el mismo agujero que el de un `[id]` abierto,
 * con dos agravantes: no hay path que mirar (por eso ningún ratchet los veía) y el
 * efecto no se deshace con un UPDATE, porque del otro lado hay un despacho pedido y
 * una factura del carrier.
 *
 * No usa `assertIdInSite`: `order` es del core de Medusa y su eje es la columna
 * `sales_channel_id` de la propia fila, no un descriptor de los nuestros. Es la
 * misma traducción que ya hacen los listados hermanos con `site_channel_ids`.
 *
 * `null` = no hay que filtrar (mono-tienda, registro ausente, ninguna elegida), que
 * es el comportamiento histórico. Con tienda activa devuelve el SET de las que sí
 * son suyas, y el call site tiene que rechazar el resto POR ÍTEM en vez de cortar
 * el lote: estos bulks ya reportan `failed` por orden, y fallar el lote entero por
 * un id ajeno le escondería al operador las 49 que sí salieron.
 *
 * Una orden sin `sales_channel_id` NO entra: es data singular huérfana, y para esa
 * forma el repo ya decidió fail-closed (`empty: 'unassigned'`). Con envíos
 * facturables de por medio, adivinar de quién es sale caro.
 */
export async function orderIdsInSite(
  req: MedusaRequest,
  orderIds: string[],
): Promise<Set<string> | null> {
  const resolution = await siteFromRequest(req);
  if (resolution.status !== 'site') return null;
  if (orderIds.length === 0) return new Set();

  const allowedChannels = new Set(resolution.site.channel_ids);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = (await query.graph({
    entity: 'order',
    fields: ['id', 'sales_channel_id'],
    filters: { id: orderIds },
  })) as { data: Array<{ id?: string | null; sales_channel_id?: string | null }> };

  const own = new Set<string>();
  for (const order of data) {
    if (!order.id || !order.sales_channel_id) continue;
    if (allowedChannels.has(order.sales_channel_id)) own.add(order.id);
  }
  return own;
}

/**
 * El error por ítem, escrito una vez para que los dos bulks digan lo mismo.
 *
 * Las claves son `code`/`error` porque es la forma que ya tienen los `failed[]` de
 * los dos: se spreadea sobre `{ order_id }` y entra sin traducción.
 */
export const ORDER_NOT_IN_SITE = {
  code: 'NOT_FOUND',
  // No dice "es de otra tienda": eso confirmaría que la orden existe. Misma
  // política que el 404 de `assertIdInSite`.
  error: 'La orden no existe o no pertenece a la tienda activa.',
} as const;
