import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { redeemRewardWorkflow } from '../../../../workflows/redeem-reward';

type RedeemBody = { reward_id: string; sales_channel_id?: string | null };

// Redeem a reward: spends points and produces the benefit (coupon / store credit)
// transactionally. Points are refunded automatically if the benefit fails.
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    res.status(401).json({ message: 'No autenticado' });
    return;
  }

  const body = (req.validatedBody ?? req.body) as RedeemBody;
  const redemptionRef = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { result } = await redeemRewardWorkflow(req.scope).run({
      input: {
        customer_id: customerId,
        reward_id: body.reward_id,
        redemption_ref: redemptionRef,
        sales_channel_id: body.sales_channel_id ?? null,
      },
    });
    res.json({ grant: result.grant, already: result.already });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
}
