import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../modules/ai-assistant';

type AiService = any;

/** GET /admin/ai-assistant/runs — últimas corridas de los agentes (trazabilidad). */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
  const filters: Record<string, unknown> = {};
  if (kind) filters.kind = kind;

  const runs = await service.listAgentRuns(filters, {
    order: { created_at: 'DESC' },
    take: 100,
  });
  res.json({ runs });
};
