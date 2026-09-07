import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../lib/multistore/scope';
import { RECURRING_ORDER_SITE_SCOPE } from '../../../../modules/recurring-order/site-scope';
import { RECURRING_ORDER_MODULE } from '../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../modules/recurring-order/service';

/** Detalle completo: suscripción + items + ciclos con su historial de intentos. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Todos los handlers: pausar o cancelar la suscripción de otra tienda le corta
  // la entrega a un cliente que no es de quien la cancela.
  await assertIdInSite(req.scope, await siteFromRequest(req), RECURRING_ORDER_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const recurringOrder = await service.retrieveRecurringOrder(req.params.id as string);

  const items = await service.listRecurringOrderItems({
    recurring_order_id: recurringOrder.id,
  });
  const cycles = await service.listRenewalCycles(
    { recurring_order_id: recurringOrder.id },
    { take: 50, order: { scheduled_at: 'DESC' }, relations: ['attempts'] },
  );
  // Timeline de auditoría + case de cancelación (motivo/desenlace), si existen.
  const logs = await service.listRecurringLogs(
    { recurring_order_id: recurringOrder.id },
    { take: 100, order: { created_at: 'DESC' } },
  );
  const cancellationCases = await service.listCancellationCases(
    { recurring_order_id: recurringOrder.id },
    { take: 5, order: { created_at: 'DESC' } },
  );

  res.status(200).json({
    recurring_order: {
      ...recurringOrder,
      items,
      cycles,
      logs,
      cancellation_cases: cancellationCases,
    },
  });
}
