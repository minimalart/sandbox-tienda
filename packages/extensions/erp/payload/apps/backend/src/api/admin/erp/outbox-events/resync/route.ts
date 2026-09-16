import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { ERP_MODULE } from '../../../../../modules/erp';
import type ErpModuleService from '../../../../../modules/erp/service';
import type { ErpOutboxEventRow } from '../../../../../modules/erp/service';
import { RESYNC_BULK_STATUSES } from '../../../../../modules/erp/outbox/resync-decision';
import { resyncSalesForOrders } from '../../../../../modules/erp/outbox/resync-sale';
import type { PostErpOutboxResyncInput } from '../../validators';

/**
 * POST /admin/erp/outbox-events/resync — reenvío manual de ventas al ERP en los
 * tres modos que pide el panel de Ventas:
 *
 * - **singular**: `{ event_ids: ['erpobx_…'] }` (o `order_ids` desde el widget
 *   de la orden, que no conoce el id del evento).
 * - **parcial**: los ids de la selección de la tabla.
 * - **masivo**: `{ statuses: [...] }`, y sin `statuses` barre el default de
 *   `RESYNC_BULK_STATUSES` = `skipped`/`failed`/`dead_letter`.
 *
 * `sent` y `duplicate` NUNCA entran en el barrido masivo, y de a uno exigen
 * `force: true`: no todos los ERP deduplican y reenviar puede emitir el
 * comprobante dos veces (el porqué completo está en `resync-decision.ts`).
 *
 * El `limit` es un techo real, no paginación: cada orden es un
 * `buildSalePayload` con varias consultas al grafo, así que un barrido sin tope
 * sobre miles de órdenes sería una tormenta contra la base disparada por un
 * click. Con más filas de las que entran, la respuesta dice cuántas quedaron.
 */

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const body = (req.validatedBody ?? {}) as PostErpOutboxResyncInput;

  const config = await service.getConfig();
  if (!config) {
    res.status(400).json({ message: 'No hay una configuración de ERP guardada.' });
    return;
  }
  if (!config.enabled || !config.sales_notify_enabled) {
    // 400 y no un resultado vacío: el processor no toma ni un `pending` con la
    // notificación apagada, así que reencolar acá dejaría filas que no salen.
    res.status(400).json({
      message:
        'La notificación de ventas al ERP está apagada. Prendela en la configuración antes de reenviar.',
    });
    return;
  }

  const limit = Math.min(body.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const force = body.force ?? false;

  let orderIds: string[];
  let pendingBeyondLimit = 0;

  if (body.order_ids?.length) {
    orderIds = body.order_ids.slice(0, limit);
    pendingBeyondLimit = Math.max(body.order_ids.length - orderIds.length, 0);
  } else if (body.event_ids?.length) {
    // Los ids de evento se traducen a órdenes: el resync rearma el payload
    // desde la orden, así que la orden es la unidad real de trabajo.
    const events = (await service.listErpOutboxEvents(
      { id: body.event_ids, event_type: 'sale_created' },
      { take: limit }
    )) as unknown as ErpOutboxEventRow[];
    orderIds = events.map((event) => event.aggregate_id);
    pendingBeyondLimit = Math.max(body.event_ids.length - orderIds.length, 0);
  } else {
    const statuses = body.statuses?.length ? body.statuses : [...RESYNC_BULK_STATUSES];
    const [events, total] = await service.listAndCountErpOutboxEvents(
      { status: statuses, event_type: 'sale_created' },
      { take: limit, order: { created_at: 'ASC' } }
    );
    orderIds = (events as unknown as ErpOutboxEventRow[]).map((event) => event.aggregate_id);
    pendingBeyondLimit = Math.max(total - orderIds.length, 0);
  }

  if (!orderIds.length) {
    res.status(200).json({ requeued: 0, total: 0, remaining: 0, results: [], by_reason: {} });
    return;
  }

  const { results, requeued } = await resyncSalesForOrders(req.scope, {
    config,
    orderIds,
    force,
  });

  // Agregado por motivo: en un barrido de 200 el operador necesita "150 salieron,
  // 50 ya estaban enviadas", no 200 filas para leer una por una.
  const byReason: Record<string, number> = {};
  for (const row of results) byReason[row.reason] = (byReason[row.reason] ?? 0) + 1;

  logger.info(
    `[erp] resync manual de ventas por ${req.auth_context?.actor_id ?? 'admin'}: ${requeued}/${results.length} reencoladas${force ? ' (forzado)' : ''}.`
  );

  res.status(200).json({
    requeued,
    total: results.length,
    remaining: pendingBeyondLimit,
    by_reason: byReason,
    results,
  });
}
