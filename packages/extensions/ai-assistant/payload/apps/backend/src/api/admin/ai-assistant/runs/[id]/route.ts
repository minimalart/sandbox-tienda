import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../modules/ai-assistant';

type AiService = any;

/** GET /admin/ai-assistant/runs/:id — corrida + sus pasos (modelo/tool/handoff). */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const run = await service.retrieveAgentRun(req.params.id).catch(() => null);
  if (!run) {
    res.status(404).json({ message: 'Corrida no encontrada.' });
    return;
  }
  const steps = await service.listAgentSteps(
    { run_id: run.id },
    { order: { idx: 'ASC' }, take: 500 },
  );
  res.json({ run, steps });
};
