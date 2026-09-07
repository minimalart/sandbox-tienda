import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { RECURRING_ORDER_MODULE } from '../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../modules/recurring-order/service';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { RENEWAL_CYCLE_SITE_SCOPE } from '../../../../modules/recurring-order/site-scope';

/**
 * GET /admin/recurring-orders/cycles — cola GLOBAL de renovaciones (todas las
 * suscripciones), filtrable por estado, rango de fecha programada y orden
 * generada (esto último lo usa el widget del detalle de orden).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const status = req.query.status as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const orderId = req.query.order_id as string | undefined;

  const scheduledFilter: Record<string, Date> = {};
  if (from) scheduledFilter.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) scheduledFilter.$lte = new Date(`${to}T23:59:59.999Z`);

  // El descriptor dejó de declararse inline: vive en `modules/recurring-order/site-scope.ts`
  // (renombrado a `RENEWAL_CYCLE_SITE_SCOPE`, porque al lado de `RECURRING_ORDER_` y
  // `RECURRING_OFFER_` un "CYCLE" a secas no dice de qué tabla habla). El porqué de que el
  // ciclo herede la tienda por `recurring_order_id` y de `empty: 'unassigned'` viaja con él.
  const [cycles, count] = await service.listAndCountRenewalCycles(
    {
      ...(await siteFilter(req.scope, await siteFromRequest(req), RENEWAL_CYCLE_SITE_SCOPE)),
      ...(status ? { status } : {}),
      ...(Object.keys(scheduledFilter).length ? { scheduled_at: scheduledFilter } : {}),
      ...(orderId ? { generated_order_id: orderId } : {}),
    },
    { take: limit, skip: offset, order: { scheduled_at: 'DESC' } },
  );

  // Resumen de la suscripción dueña (cliente/frecuencia) para el listado.
  const subIds = [...new Set(cycles.map((c: any) => c.recurring_order_id))];
  const subs = subIds.length
    ? await service.listRecurringOrders({ id: subIds }, { take: subIds.length })
    : [];
  const subById = new Map(subs.map((s: any) => [s.id, s]));

  res.status(200).json({
    cycles: cycles.map((c: any) => {
      const sub: any = subById.get(c.recurring_order_id);
      return {
        id: c.id,
        recurring_order_id: c.recurring_order_id,
        scheduled_at: c.scheduled_at,
        processed_at: c.processed_at ?? null,
        status: c.status,
        attempt_count: c.attempt_count ?? 0,
        last_error: c.last_error ?? null,
        generated_order_id: c.generated_order_id ?? null,
        confirmation_url: c.confirmation_url ?? null,
        expires_at: c.expires_at ?? null,
        totals: c.metadata?.totals ?? null,
        subscription: sub
          ? {
              email: sub.email ?? null,
              status: sub.status,
              frequency_interval: sub.frequency_interval,
              frequency_count: sub.frequency_count,
            }
          : null,
      };
    }),
    count,
    limit,
    offset,
  });
}
