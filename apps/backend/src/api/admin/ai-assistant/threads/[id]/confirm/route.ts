import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../../modules/ai-assistant';
import { STORE_CONFIG_MODULE } from '../../../../../../modules/store-config';
import type StoreConfigModuleService from '../../../../../../modules/store-config/service';
import {
  confirmTools,
  loadThreadView,
  memoryOptionsFromConfig,
  type AiStore,
} from '../../../../../../modules/ai-assistant/ai/agent';
import type { AdminConfirmToolsType } from '../../../validators';

type AiService = any;

/** POST /admin/ai-assistant/threads/:id/confirm — resuelve tools pendientes. */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminConfirmToolsType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const { id } = req.params;
  const createdBy = req.auth_context?.actor_id ?? 'unknown';

  const thread = await service.retrieveChatThread(id).catch(() => null);
  if (!thread || thread.created_by !== createdBy) {
    res.status(404).json({ message: 'Hilo no encontrado.' });
    return;
  }

  try {
    const storeConfig: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const ai = await storeConfig.getAiConfig();
    const result = await confirmTools({
      store: service as AiStore,
      threadId: thread.id,
      decisions: req.validatedBody.decisions,
      model: req.validatedBody.model || ai.chat_model,
      maxTokens: ai.chat_max_tokens,
      reasoningEffort: ai.chat_reasoning_effort,
      nativeCtx: {
        container: req.scope,
        store: service as AiStore,
        threadId: thread.id,
      },
      memory: memoryOptionsFromConfig(ai, createdBy),
    });
    const view = await loadThreadView(service as AiStore, thread.id);
    res.json({ status: result.status, ...view });
  } catch (e) {
    console.error('[ai-assistant] confirm turn failed:', (e as Error).message, e);
    const status = (e as { status?: number }).status ?? 500;
    res.status(status).json({ message: (e as Error).message });
  }
};
