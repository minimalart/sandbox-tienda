import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../modules/ai-assistant';
import type { AdminCreateThreadType } from '../validators';

type AiService = any;

/** GET /admin/ai-assistant/threads — hilos activos del usuario actual. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const createdBy = req.auth_context?.actor_id ?? 'unknown';

  const threads = await service.listChatThreads(
    { created_by: createdBy, status: 'active' },
    { order: { updated_at: 'DESC' }, take: 100 },
  );

  res.json({ threads });
};

/** POST /admin/ai-assistant/threads — crea un hilo. */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreateThreadType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const createdBy = req.auth_context?.actor_id ?? 'unknown';
  const title = req.validatedBody?.title?.trim() || 'Nuevo chat';

  const thread = await service.createChatThreads({
    title,
    status: 'active',
    created_by: createdBy,
  });

  // El system prompt ya no se persiste: se compone en runtime por agente activo
  // en cada vuelta del loop (ver `runLoop` / `buildSystemPrompt`).
  res.status(201).json({ thread });
};
