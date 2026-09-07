import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../modules/ai-assistant';
import { loadThreadView, type AiStore } from '../../../../../modules/ai-assistant/ai/agent';

type AiService = any;

async function getOwnedThread(req: AuthenticatedMedusaRequest, service: AiService) {
  const { id } = req.params;
  const createdBy = req.auth_context?.actor_id ?? 'unknown';
  const thread = await service.retrieveChatThread(id).catch(() => null);
  if (!thread || thread.created_by !== createdBy) return null;
  return thread;
}

/** GET /admin/ai-assistant/threads/:id — hilo + mensajes + tools pendientes. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const thread = await getOwnedThread(req, service);
  if (!thread) {
    res.status(404).json({ message: 'Hilo no encontrado.' });
    return;
  }

  const view = await loadThreadView(service as AiStore, thread.id);
  res.json({ thread, ...view });
};

/** DELETE /admin/ai-assistant/threads/:id — archiva el hilo. */
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const thread = await getOwnedThread(req, service);
  if (!thread) {
    res.status(404).json({ message: 'Hilo no encontrado.' });
    return;
  }

  await service.updateChatThreads({ id: thread.id, status: 'archived' });
  res.json({ id: thread.id, deleted: true });
};
