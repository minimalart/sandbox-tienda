import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../modules/ai-assistant';
import { normalizeManifest } from '../../../../modules/ai-assistant/ai/agent-manifest';
import type { AdminSaveAgentType } from '../validators';

type AiService = any;

/** GET /admin/ai-assistant/agents — todos los agentes (incluye deshabilitados). */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const agents = await service.listAgents({}, { order: { rank: 'ASC' }, take: 200 });
  res.json({ agents });
};

/** POST /admin/ai-assistant/agents — crea un agente (manifiesto declarativo). */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSaveAgentType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const manifest = normalizeManifest(req.validatedBody);
  if (!manifest.key) {
    res.status(400).json({ message: 'La key (o el nombre) es obligatoria.' });
    return;
  }
  const existing = await service.listAgents({ key: manifest.key }, { take: 1 });
  if (existing?.[0]) {
    res.status(409).json({ message: `Ya existe un agente con key "${manifest.key}".` });
    return;
  }
  const agent = await service.createAgents({ ...manifest, source: 'custom' });
  res.status(201).json({ agent });
};
