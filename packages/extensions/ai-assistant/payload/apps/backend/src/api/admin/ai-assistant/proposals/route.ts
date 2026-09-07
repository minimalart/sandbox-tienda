import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../modules/ai-assistant';

type AiService = any;

/** GET /admin/ai-assistant/proposals?status= — lista de propuestas (org-wide). */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;

  const proposals = await service.listProposals(filters, {
    order: { created_at: 'DESC' },
    take: 100,
  });
  res.json({ proposals });
};
