import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../modules/ai-assistant';
import { slugifyKey } from '../../../../modules/ai-assistant/ai/agent-manifest';
import { AdminSaveWorkflowSchema } from '../validators';

type AiService = any;

/** GET /admin/ai-assistant/workflows — definiciones de workflow (para la pantalla). */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const workflows = await service.listWorkflowDefinitions({}, { order: { name: 'ASC' }, take: 200 });
  res.json({ workflows });
};

/** POST /admin/ai-assistant/workflows — crea una definición de workflow. */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  let body: ReturnType<typeof AdminSaveWorkflowSchema.parse>;
  try {
    body = AdminSaveWorkflowSchema.parse(req.body);
  } catch (e) {
    res.status(400).json({ message: (e as Error).message });
    return;
  }
  const key = slugifyKey(body.key || body.name);
  if (!key) {
    res.status(400).json({ message: 'La key (o el nombre) es obligatoria.' });
    return;
  }
  const existing = await service.listWorkflowDefinitions({ key }, { take: 1 });
  if (existing?.[0]) {
    res.status(409).json({ message: `Ya existe un workflow con key "${key}".` });
    return;
  }
  const workflow = await service.createWorkflowDefinitions({
    key,
    name: body.name.trim(),
    description: body.description ?? null,
    enabled: body.enabled ?? true,
    steps: body.steps,
    final_action: body.final_action ?? { type: 'none' },
    source: 'custom',
    created_by: req.auth_context?.actor_id ?? null,
  });
  res.status(201).json({ workflow });
};
