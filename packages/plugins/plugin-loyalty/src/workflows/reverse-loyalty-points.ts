import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { POINTS_MODULE } from '../modules/points';
import type PointsModuleService from '../modules/points/service';

export type ReverseLoyaltyPointsInput = {
  customer_id: string;
  reference?: string; // source kind of the earn, defaults to 'order'
  reference_id: string; // e.g. the order id
};

// Claws back the points earned from a given source (order canceled / returned).
// Idempotent: each reversal keys off the original earn txn id, so re-running or
// a duplicate event never double-reverses.
const reverseStep = createStep(
  'loyalty-reverse-points',
  async (input: ReverseLoyaltyPointsInput, { container }) => {
    const points = container.resolve<PointsModuleService>(POINTS_MODULE);
    const account = await points.getOrCreateAccount(input.customer_id);

    const earns = (await points.listPointsTransactions({
      account_id: account.id,
      type: 'earn',
      reference: input.reference ?? 'order',
      reference_id: input.reference_id,
    })) as Array<Record<string, any>>;

    let reversed = 0;
    for (const e of earns) {
      const amount = Number(e.amount) || 0;
      if (amount <= 0) continue;
      const res = await points.reversePoints(input.customer_id, amount, {
        reference: 'order_reversal',
        reference_id: input.reference_id,
        idempotency_key: `reverse:earn:${e.id}`,
      });
      if (res) reversed += amount;
    }

    return new StepResponse({ reversed });
  },
);

export const reverseLoyaltyPointsWorkflow = createWorkflow(
  'reverse-loyalty-points',
  (input: ReverseLoyaltyPointsInput) => {
    return new WorkflowResponse(reverseStep(input));
  },
);
