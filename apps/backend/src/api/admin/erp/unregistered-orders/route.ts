import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../../../../modules/erp';
import type ErpModuleService from '../../../../modules/erp/service';
import type { ErpOutboxEventRow } from '../../../../modules/erp/service';
import { resolveSalesTrigger } from '../../../../modules/erp/billing-deposito';
import { selectUnregisteredOrders } from '../../../../modules/erp/outbox/unregistered-orders';

/**
 * GET /admin/erp/unregistered-orders — órdenes que YA deberían estar
 * notificadas al ERP y no tienen NI UNA fila en el outbox.
 *
 * La pantalla de Ventas se alimentaba sólo del outbox, así que una orden que
 * nunca se encoló no aparecía en ningún lado. Con el event bus caído eso es
 * invisible por completo: no hay fila `pending`, ni `failed`, ni un error en
 * los logs del ERP — sólo una venta que no llegó. Medido en desdeelsur: 9
 * órdenes con el pago capturado y sin fila, todas posteriores al segundo en que
 * murió el bus (ver `modules/erp/outbox/unregistered-orders.ts`).
 *
 * Se mira desde las ÓRDENES hacia el outbox, nunca al revés, porque el dato que
 * falta es justamente la fila.
 *
 * El `limit` es un techo sobre las órdenes MÁS RECIENTES, no paginación: una
 * instalación con 50.000 órdenes no puede cruzarlas todas en una request de
 * panel, y el caso de uso es "algo se cortó hace poco". La respuesta dice
 * cuántas órdenes se examinaron para que el número no se lea como un total.
 */

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

type OrderRow = {
  id: string;
  display_id?: number | null;
  status?: string | null;
  payment_status?: string | null;
  fulfillment_status?: string | null;
  total?: number | null;
  created_at?: string | Date | null;
};

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const config = await service.getConfig();

  if (!config) {
    res.status(200).json({ orders: [], count: 0, scanned: 0, discarded: {}, enabled: false });
    return;
  }

  const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: [
      'id',
      'display_id',
      'status',
      'payment_status',
      'fulfillment_status',
      'total',
      'created_at',
    ],
    pagination: { take: limit, order: { created_at: 'DESC' } },
  })) as { data: OrderRow[] };

  // Las filas existentes se buscan POR LAS ÓRDENES que se trajeron, no
  // pidiendo el outbox completo: con el outbox grande y el lote de órdenes
  // chico, filtrar por `aggregate_id` es una consulta acotada en lugar de
  // traerse la tabla para descartar casi todo en memoria.
  const existing = (await service.listErpOutboxEvents(
    {
      event_type: 'sale_created',
      provider: config.provider,
      aggregate_id: orders.map((order) => order.id),
    },
    { take: null }
  )) as unknown as ErpOutboxEventRow[];

  const { orders: unregistered, discarded } = selectUnregisteredOrders({
    orders: orders.map((order) => ({
      id: order.id,
      display_id: order.display_id ?? null,
      status: order.status ?? null,
      payment_status: order.payment_status ?? null,
      fulfillment_status: order.fulfillment_status ?? null,
      total: typeof order.total === 'number' ? order.total : null,
      created_at: order.created_at ? new Date(order.created_at).toISOString() : null,
    })),
    existingOrderIds: existing.map((event) => event.aggregate_id),
    trigger: resolveSalesTrigger(config.settings),
  });

  res.status(200).json({
    orders: unregistered,
    count: unregistered.length,
    /** Cuántas órdenes se examinaron: `count` NO es un total del histórico. */
    scanned: orders.length,
    discarded,
    trigger: resolveSalesTrigger(config.settings),
    // La UI necesita distinguir "no hay nada atrasado" de "el ERP está apagado
    // y por eso no hay nada": son dos pantallas vacías con causas opuestas.
    enabled: config.enabled && config.sales_notify_enabled,
  });
}
