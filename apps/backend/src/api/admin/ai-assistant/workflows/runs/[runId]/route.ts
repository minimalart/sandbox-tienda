import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../../modules/ai-assistant';

type AiService = any;

/** GET /admin/ai-assistant/workflows/runs/:runId — corrida completa (con `state`). */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const run = await service.retrieveWorkflowRun(req.params.runId).catch(() => null);
  if (!run) {
    res.status(404).json({ message: 'Corrida de workflow no encontrada.' });
    return;
  }
  res.json({ run });
};
