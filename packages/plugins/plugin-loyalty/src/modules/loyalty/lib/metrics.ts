import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { POINTS_MODULE } from '../../points';
import type PointsModuleService from '../../points/service';
import type { CustomerMetrics } from './tiers';

// Aggregates the metrics tiers are computed from: lifetime points earned, total
// spend and order count. Not pure (reads the ledger + orders), kept out of the
// pure tier math so `tiers.ts` stays unit-testable.
export async function gatherCustomerMetrics(
  container: { resolve: (k: string) => any },
  customerId: string,
): Promise<CustomerMetrics> {
  const points = container.resolve(POINTS_MODULE) as PointsModuleService;
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (input: unknown) => Promise<{ data: Array<Record<string, any>> }>;
  };

  const account = await points.getOrCreateAccount(customerId);
  const earns = (await points.listPointsTransactions({
    account_id: account.id,
    type: 'earn',
  })) as Array<{ amount: number }>;
  const lifetimePoints = earns.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  let spend = 0;
  let orderCount = 0;
  try {
    const { data: orders } = await query.graph({
      entity: 'order',
      fields: ['total'],
      filters: { customer_id: customerId },
    });
    orderCount = orders.length;
    spend = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  } catch {
    // orders not reachable in this context → spend/orders stay 0
  }

  return { points: lifetimePoints, spend, orders: orderCount };
}
