import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { siteFromRequest } from '../../../../../../lib/multistore';
import { assertRowInSite } from '../../../../../../lib/multistore/scope';
import { RECURRING_ORDER_MODULE } from '../../../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../../../modules/recurring-order/service';
import { SUBSCRIPTION_ALERT_SITE_SCOPE } from '../../../../../../modules/recurring-order/site-scope';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const id = req.params.alert_id as string;
  let alert: any;
  try {
    alert = await service.retrieveSubscriptionAlert(id);
  } catch {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Incidente no encontrado.');
  }
  assertRowInSite(alert, await siteFromRequest(req), SUBSCRIPTION_ALERT_SITE_SCOPE);
  const [updated] = await service.updateSubscriptionAlerts([{
    id,
    status: 'resolved',
    resolved_at: new Date(),
  }]);
  res.status(200).json({ alert: updated });
}
