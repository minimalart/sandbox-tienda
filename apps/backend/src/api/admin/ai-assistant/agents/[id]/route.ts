import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../modules/ai-assistant';
import { normalizeManifest } from '../../../../../modules/ai-assistant/ai/agent-manifest';
import type { AdminSaveAgentType } from '../../validators';

type AiService = any;

/** GET /admin/ai-assistant/agents/:id — detalle de un agente. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const agent = await service.retrieveAgent(req.params.id).catch(() => null);
  if (!agent) {
    res.status(404).json({ message: 'Agente no encontrado.' });
    return;
  }
  res.json({ agent });
};

/**
 * POST /admin/ai-assistant/agents/:id — actualiza el manifiesto. La `key` no se
 * cambia (los handoffs y `active_agent_id` la referencian): se usa la existente.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSaveAgentType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const existing = await service.retrieveAgent(req.params.id).catch(() => null);
  if (!existing) {
    res.status(404).json({ message: 'Agente no encontrado.' });
    return;
  }
  const manifest = normalizeManifest({ ...req.validatedBody, key: existing.key });
  await service.updateAgents({ id: existing.id, ...manifest });
  const agent = await service.retrieveAgent(existing.id);
  res.json({ agent });
};

/** DELETE /admin/ai-assistant/agents/:id — elimina (soft) el agente. */
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const existing = await service.retrieveAgent(req.params.id).catch(() => null);
  if (!existing) {
    res.status(404).json({ message: 'Agente no encontrado.' });
    return;
  }
  await service.deleteAgents(existing.id);
  res.json({ id: existing.id, deleted: true });
};
