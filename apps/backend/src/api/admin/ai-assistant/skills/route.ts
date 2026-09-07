import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../modules/ai-assistant';
import { slugifyKey } from '../../../../modules/ai-assistant/ai/agent-manifest';
import type { AdminSaveSkillType } from '../validators';

type AiService = any;

/** GET /admin/ai-assistant/skills — skills disponibles (para adjuntar a agentes). */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const skills = await service.listSkills({}, { order: { key: 'ASC' }, take: 100 });
  res.json({ skills });
};

/** POST /admin/ai-assistant/skills — crea un skill reutilizable. */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSaveSkillType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const body = req.validatedBody;
  const key = slugifyKey(body.key || body.name);
  if (!key) {
    res.status(400).json({ message: 'La key (o el nombre) es obligatoria.' });
    return;
  }
  const existing = await service.listSkills({ key }, { take: 1 });
  if (existing?.[0]) {
    res.status(409).json({ message: `Ya existe un skill con key "${key}".` });
    return;
  }
  const skill = await service.createSkills({
    key,
    name: body.name.trim(),
    instructions: body.instructions.trim(),
    enabled: body.enabled ?? true,
  });
  res.status(201).json({ skill });
};
