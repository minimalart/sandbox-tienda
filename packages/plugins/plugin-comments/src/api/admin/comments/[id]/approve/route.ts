import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { COMMENTS_MODULE } from '../../../../../modules/comments';
import type CommentsModuleService from '../../../../../modules/comments/service';

// POST /admin/comments/:id/approve
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const id = req.params.id as string;
  const service = req.scope.resolve<CommentsModuleService>(COMMENTS_MODULE);
  const comment = await service.approve(id);

  // Signal loyalty on manual approval (best-effort).
  try {
    await req.scope
      .resolve(Modules.EVENT_BUS)
      .emit({ name: 'comment.approved', data: { id } });
  } catch {
    // loyalty accrual must never block moderation
  }

  res.status(200).json({ comment });
}
