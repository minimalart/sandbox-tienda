import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../modules/ai-assistant';

type AiService = any;

/** DELETE /admin/ai-assistant/keys/:id — revoca la key (solo si es del usuario). */
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const { id } = req.params;
  const createdBy = req.auth_context?.actor_id ?? 'unknown';

  const key = await service.retrieveMcpApiKey(id).catch(() => null);
  if (!key || key.created_by !== createdBy) {
    res.status(404).json({ message: 'API key no encontrada.' });
    return;
  }

  await service.updateMcpApiKeys({ id, revoked: true });
  res.json({ id, revoked: true });
};
