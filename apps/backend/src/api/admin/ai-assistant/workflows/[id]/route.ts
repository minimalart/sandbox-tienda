import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../modules/ai-assistant';
import { AdminSaveWorkflowSchema } from '../../validators';

type AiService = any;

/** GET /admin/ai-assistant/workflows/:id — detalle de una definición. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const workflow = await service.retrieveWorkflowDefinition(req.params.id).catch(() => null);
  if (!workflow) {
    res.status(404).json({ message: 'Workflow no encontrado.' });
    return;
  }
  res.json({ workflow });
};

/** POST /admin/ai-assistant/workflows/:id — actualiza la definición (la key no cambia). */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const existing = await service.retrieveWorkflowDefinition(req.params.id).catch(() => null);
  if (!existing) {
    res.status(404).json({ message: 'Workflow no encontrado.' });
    return;
  }
  let body: ReturnType<typeof AdminSaveWorkflowSchema.parse>;
  try {
    body = AdminSaveWorkflowSchema.parse(req.body);
  } catch (e) {
    res.status(400).json({ message: (e as Error).message });
    return;
  }
  await service.updateWorkflowDefinitions({
    id: existing.id,
    name: body.name.trim(),
    description: body.description ?? null,
    enabled: body.enabled ?? existing.enabled,
    steps: body.steps,
    final_action: body.final_action ?? existing.final_action,
  });
  const workflow = await service.retrieveWorkflowDefinition(existing.id);
  res.json({ workflow });
};

/** DELETE /admin/ai-assistant/workflows/:id — elimina (soft) la definición. */
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const existing = await service.retrieveWorkflowDefinition(req.params.id).catch(() => null);
  if (!existing) {
    res.status(404).json({ message: 'Workflow no encontrado.' });
    return;
  }
  await service.deleteWorkflowDefinitions(existing.id);
  res.json({ id: existing.id, deleted: true });
};
