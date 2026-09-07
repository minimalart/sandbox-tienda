import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { COMMENTS_MODULE } from '../../../../../modules/comments';
import type CommentsModuleService from '../../../../../modules/comments/service';

// POST /admin/comments/:id/hide
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const id = req.params.id as string;
  const service = req.scope.resolve<CommentsModuleService>(COMMENTS_MODULE);
  const comment = await service.hide(id);
  res.status(200).json({ comment });
}
