import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../../modules/ai-assistant';
import { STORE_CONFIG_MODULE } from '../../../../../../modules/store-config';
import type StoreConfigModuleService from '../../../../../../modules/store-config/service';
import {
  loadThreadView,
  runUserTurn,
  memoryOptionsFromConfig,
  type AiStore,
} from '../../../../../../modules/ai-assistant/ai/agent';
import {
  decorateUserMessage,
  type SkillId,
} from '../../../../../../modules/ai-assistant/ai/prompt';
import {
  parseCampaignStep,
  summarizeCampaignStep,
  upsertCampaign,
} from '../../../../../../modules/ai-assistant/ai/campaign';
import type { AdminSendMessageType } from '../../../validators';

type AiService = any;

/** POST /admin/ai-assistant/threads/:id/messages — manda un mensaje y corre el loop. */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSendMessageType>,
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

  const { text, model, skill, period, agent_key } = req.validatedBody;

  // Mención `@agente`: fija el agente activo del hilo antes del turno (ver stream).
  if (agent_key) {
    const targets = await service
      .listAgents({ key: agent_key, enabled: true }, { take: 1 })
      .catch(() => [] as Array<{ id: string }>);
    if (targets[0]?.id) {
      await service
        .updateChatThreads({ id: thread.id, active_agent_id: targets[0].id })
        .catch(() => undefined);
    }
  }

  // Wizard de campaña: si el mensaje es un <campaign_step>, persistimos el patch en
  // ai_campaign y mostramos un resumen legible (ver route de stream).
  const campaignStep = parseCampaignStep(text ?? '');
  let userContent: string;
  if (campaignStep) {
    const row = await upsertCampaign({
      store: service as AiStore,
      threadId: thread.id,
      createdBy,
      patch: campaignStep.patch,
    });
    userContent = summarizeCampaignStep(campaignStep.step, row.state);
  } else {
    userContent = decorateUserMessage(text, { skill: skill as SkillId, period });
  }

  // Persistimos el mensaje del usuario (con contexto de skill/período inyectado).
  await service.createChatMessages({
    thread_id: thread.id,
    role: 'user',
    content: userContent,
    status: 'complete',
  });

  // Título del hilo desde el primer mensaje real.
  if (!thread.title || thread.title === 'Nuevo chat') {
    await service.updateChatThreads({
      id: thread.id,
      title: text.slice(0, 80),
    });
  } else {
    await service.updateChatThreads({ id: thread.id, title: thread.title });
  }

  try {
    const storeConfig: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const ai = await storeConfig.getAiConfig();
    const result = await runUserTurn({
      store: service as AiStore,
      threadId: thread.id,
      model: model || ai.chat_model,
      maxTokens: ai.chat_max_tokens,
      reasoningEffort: ai.chat_reasoning_effort,
      validationEnabled: ai.chat_validation_enabled,
      nativeCtx: {
        container: req.scope,
        store: service as AiStore,
        createdBy,
        threadId: thread.id,
      },
      memory: memoryOptionsFromConfig(ai, createdBy),
    });
    const view = await loadThreadView(service as AiStore, thread.id);
    res.json({ status: result.status, ...view });
  } catch (e) {
    console.error('[ai-assistant] messages turn failed:', (e as Error).message, e);
    const status = (e as { status?: number }).status ?? 500;
    res.status(status).json({ message: (e as Error).message });
  }
};
