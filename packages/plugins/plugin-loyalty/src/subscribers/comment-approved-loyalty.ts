import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { LOYALTY_MODULE } from '../modules/loyalty';
import type LoyaltyModuleService from '../modules/loyalty/service';
import { earnLoyaltyPointsWorkflow } from '../workflows/earn-loyalty-points';

// Awards `comment` earn rules when a customer's comment/review is approved.
// Only fixed-amount rules produce points (amount = 0). Idempotent per comment
// (the earn workflow keys off `earn:comment:<id>:<rule>`), so re-approving a
// comment never double-credits. The comments module is resolved by its literal
// key so loyalty-engine doesn't hard-depend on the comments extension.
export default async function handleLoyaltyCommentApproved({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const commentId = event.data.id;
  if (!commentId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
    if (!(await loyalty.getActiveProgram())) return;

    const comments = container.resolve('comments') as {
      listComments: (filters: Record<string, unknown>) => Promise<Array<{ customer_id?: string; status?: string }>>;
    };
    const [comment] = await comments.listComments({ id: commentId });
    if (!comment?.customer_id || comment.status !== 'approved') return;

    const { result } = await earnLoyaltyPointsWorkflow(container).run({
      input: {
        customer_id: comment.customer_id,
        event: 'comment',
        amount: 0,
        reference: 'comment',
        reference_id: commentId,
      },
    });
    const total = (result?.awarded ?? []).reduce((s, a) => s + a.points, 0);
    if (total > 0) logger.info(`[Loyalty] Comment ${commentId}: awarded ${total} points.`);
  } catch (error) {
    logger.error(`[Loyalty] comment earn failed for ${commentId}: ${(error as Error).message}`);
  }
}

export const config: SubscriberConfig = {
  event: 'comment.approved',
};
