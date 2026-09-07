import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { POINTS_MODULE } from '../../../modules/points';
import type PointsModuleService from '../../../modules/points/service';

type PointsTransaction = {
  id: string;
  reference: string | null;
  reference_id: string | null;
  [key: string]: unknown;
};

// GET /store/points — the authenticated customer's balance and transaction history.
// Order-referenced transactions are enriched with the order's display_id so the
// storefront can show which purchase generated each movement.
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const service = req.scope.resolve<PointsModuleService>(POINTS_MODULE);

  const accounts = await service.listPointsAccounts(
    { customer_id: customerId },
    { relations: ['transactions'] },
  );
  const account = accounts[0] as
    | { balance: number; transactions?: PointsTransaction[] }
    | undefined;

  const transactions = account?.transactions ?? [];

  // Resolve order display_ids for `order` transactions (single batched query).
  const orderIds = [
    ...new Set(
      transactions
        .filter((t) => t.reference === 'order' && t.reference_id)
        .map((t) => t.reference_id as string),
    ),
  ];

  const displayById = new Map<string, number>();
  if (orderIds.length) {
    try {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
      const { data: orders } = await query.graph({
        entity: 'order',
        fields: ['id', 'display_id'],
        filters: { id: orderIds },
      });
      for (const o of orders as { id: string; display_id: number }[]) {
        displayById.set(o.id, o.display_id);
      }
    } catch {
      // Non-fatal: movements still render without the order number.
    }
  }

  const enriched = transactions.map((t) => ({
    ...t,
    order_display_id:
      t.reference === 'order' && t.reference_id ? (displayById.get(t.reference_id) ?? null) : null,
  }));

  res.status(200).json({
    points: {
      balance: account?.balance ?? 0,
      transactions: enriched,
    },
  });
}
