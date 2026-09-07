import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { POINTS_MODULE } from '../../../../modules/points';
import type PointsModuleService from '../../../../modules/points/service';

// POST /store/points/redeem — debit points from the authenticated customer.
// Converting redeemed points into a cart discount happens at checkout (storefront
// integration); this endpoint owns the balance/ledger side only.
export async function POST(
  req: AuthenticatedMedusaRequest<{ amount?: number }>,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const amount = req.body?.amount;

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ message: 'amount must be a positive number' });
    return;
  }

  const service = req.scope.resolve<PointsModuleService>(POINTS_MODULE);

  try {
    const account = await service.redeemPoints(customerId, amount, { reference: 'manual' });
    res.status(200).json({ balance: account.balance, redeemed: amount });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
}
