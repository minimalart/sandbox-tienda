import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../modules/ai-assistant';
import { STORE_CONFIG_MODULE } from '../../../../../modules/store-config';
import type StoreConfigModuleService from '../../../../../modules/store-config/service';
import {
  memoryOptionsFromConfig,
  type MemoryRuntimeOptions,
} from '../../../../../modules/ai-assistant/ai/agent';
import { generateProposals } from '../../../../../modules/ai-assistant/ai/proposal-engine';
import type { AdminGenerateProposalsType } from '../../validators';

type AiService = any;

/**
 * POST /admin/ai-assistant/proposals/generate — dispara el motor de propuestas a
 * mano (sin esperar al cron) y persiste las propuestas generadas. Útil para
 * probar y para el botón "Generar propuestas" de la UI. Con `agent_key` corre
 * SOLO ese agente en modo simple.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminGenerateProposalsType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const body = req.validatedBody ?? {};
  const limit = body.limit ?? 3;
  const createdBy = req.auth_context?.actor_id ?? 'unknown';

  try {
    let model: string | undefined;
    let maxTokens: number | undefined;
    let reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' | undefined;
    let memory: MemoryRuntimeOptions | undefined;
    try {
      const storeConfig: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
      const ai = await storeConfig.getAiConfig();
      model = ai.chat_model;
      maxTokens = ai.chat_max_tokens;
      reasoningEffort = ai.chat_reasoning_effort;
      memory = memoryOptionsFromConfig(ai, createdBy);
    } catch {
      // sin store-config: se cae a los defaults del chat-client.
    }

    const { created, agentKeys, engine } = await generateProposals({
      container: req.scope,
      service,
      limit,
      agentKey: body.agent_key,
      createdBy,
      model,
      maxTokens,
      reasoningEffort,
      memory,
      log: (msg) => console.info(`[ai-assistant] ${msg}`),
    });
    res.json({ created: created.length, proposals: created, agents: agentKeys, engine });
  } catch (e) {
    console.error('[ai-assistant] generate proposals failed:', (e as Error).message, e);
    const status = (e as { status?: number }).status ?? 500;
    res.status(status).json({ message: (e as Error).message });
  }
};
