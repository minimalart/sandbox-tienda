import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import {
  createGiftCardsWorkflow,
  CreateGiftCardsWorkflowInput,
} from '@medusajs/loyalty-plugin/workflows';

// Thin wrapper over the loyalty plugin's high-level workflow. The plugin's
// createGiftCardsWorkflow orchestrates the full setup: create the gift card →
// create the backing store-credit account → link them → credit the account.
// Its input natively accepts `customer_id: string | null` (null = unassigned,
// claimed later). This wrapper exposes a single-card signature.
export type CreateGiftCardInput = CreateGiftCardsWorkflowInput[number];

export const createGiftCardWorkflow = createWorkflow(
  'create-gift-card',
  (input: CreateGiftCardInput) => {
    const giftCards = createGiftCardsWorkflow.runAsStep({ input: [input] });

    return new WorkflowResponse({ giftCard: giftCards[0] });
  },
);
