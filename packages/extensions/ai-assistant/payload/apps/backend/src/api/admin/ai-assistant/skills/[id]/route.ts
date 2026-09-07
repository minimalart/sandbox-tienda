import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../modules/ai-assistant';
import type { AdminSaveSkillType } from '../../validators';

type AiService = any;

/** GET /admin/ai-assistant/skills/:id — detalle de un skill. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const skill = await service.retrieveSkill(req.params.id).catch(() => null);
  if (!skill) {
    res.status(404).json({ message: 'Skill no encontrado.' });
    return;
  }
  res.json({ skill });
};

/**
 * POST /admin/ai-assistant/skills/:id — actualiza el skill. La `key` no se cambia
 * (la referencian los `Agent.skills`): se conserva la existente.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSaveSkillType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const existing = await service.retrieveSkill(req.params.id).catch(() => null);
  if (!existing) {
    res.status(404).json({ message: 'Skill no encontrado.' });
    return;
  }
  const body = req.validatedBody;
  await service.updateSkills({
    id: existing.id,
    name: body.name.trim(),
    instructions: body.instructions.trim(),
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
  });
  const skill = await service.retrieveSkill(existing.id);
  res.json({ skill });
};

/** DELETE /admin/ai-assistant/skills/:id — elimina (soft) el skill. */
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const existing = await service.retrieveSkill(req.params.id).catch(() => null);
  if (!existing) {
    res.status(404).json({ message: 'Skill no encontrado.' });
    return;
  }
  await service.deleteSkills(existing.id);
  res.json({ id: existing.id, deleted: true });
};
