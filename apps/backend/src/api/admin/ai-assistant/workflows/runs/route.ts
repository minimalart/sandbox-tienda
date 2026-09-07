import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../modules/ai-assistant';

type AiService = any;

/**
 * GET /admin/ai-assistant/workflows/runs — últimas corridas del motor de workflows
 * (observabilidad). Sin esto, un run `failed` era una caja negra: el checklist con
 * el `result_summary` del paso que falló solo vivía en la DB (bloqueada por
 * allowlist en prod). Filtros: ?status=failed&workflow_key=receta&thread_id=...
 * El listado omite `state` (puede ser grande); el detalle por id lo trae completo.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const filters: Record<string, unknown> = {};
  for (const key of ['status', 'workflow_key', 'thread_id'] as const) {
    if (typeof req.query[key] === 'string') filters[key] = req.query[key];
  }
  const take = Math.min(Number.parseInt(String(req.query.take ?? ''), 10) || 20, 100);

  const rows = await service.listWorkflowRuns(filters, {
    order: { created_at: 'DESC' },
    take,
  });
  const runs = (rows as Record<string, unknown>[]).map(({ state, ...rest }) => rest);
  res.json({ runs });
};
