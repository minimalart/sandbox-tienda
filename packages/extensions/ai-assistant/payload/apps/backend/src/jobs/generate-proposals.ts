import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { AI_ASSISTANT_MODULE } from '../modules/ai-assistant';
import { STORE_CONFIG_MODULE } from '../modules/store-config';
import type StoreConfigModuleService from '../modules/store-config/service';
import { isChatAiConfigured } from '../modules/ai-assistant/ai/chat-client';
import { memoryOptionsFromConfig, type MemoryRuntimeOptions } from '../modules/ai-assistant/ai/agent';
import { generateProposals } from '../modules/ai-assistant/ai/proposal-engine';
import { getAiAssistantSettings } from '../modules/ai-assistant/settings';

/**
 * Job proactivo de Propuestas: corre el motor de propuestas (detector → triage →
 * especialistas; o fan-out simple según el motor elegido) y deja Propuestas
 * (status 'pending') para que un humano revise/apruebe. Se saltea si ya hay
 * pendientes sin revisar (no acumula) o si falta la API key del modelo. La
 * ejecución de las acciones aprobadas la hace el endpoint /approve (no acá).
 *
 * El límite y el override de agente se leen DENTRO del cuerpo y no en `const` de
 * nivel superior: el job loader importa este módulo durante el arranque, antes de
 * que el loader de `app-settings` haya llenado el snapshot, así que un `const`
 * arriba se quedaba pegado al `process.env` del boot y ninguna fila en la base lo
 * habría movido nunca. Lo único que sigue horneado al arrancar es el `schedule:`
 * de abajo, y ese sí no tiene arreglo: lo lee Medusa, no nosotros.
 */
export default async function generateProposalsJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  if (!isChatAiConfigured()) {
    logger.warn('[proposals cron] OPENROUTER_API_KEY no configurada; se omite.');
    return;
  }
  const { proposalsAgent, proposalsLimit } = getAiAssistantSettings();
  const service: any = container.resolve(AI_ASSISTANT_MODULE);

  // No acumular: si ya hay propuestas pendientes de revisión, no generamos más.
  try {
    const pending = await service.listProposals({ status: 'pending' }, { take: 1 });
    if (pending?.length) {
      logger.info('[proposals cron] Hay propuestas pendientes de revisión; se omite esta corrida.');
      return;
    }
  } catch (err) {
    logger.warn(`[proposals cron] list pending falló: ${(err as Error).message}`);
    return;
  }

  let model: string | undefined;
  let maxTokens: number | undefined;
  let reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' | undefined;
  let memory: MemoryRuntimeOptions | undefined;
  try {
    const storeConfig: StoreConfigModuleService = container.resolve(STORE_CONFIG_MODULE);
    const ai = await storeConfig.getAiConfig();
    model = ai.chat_model;
    maxTokens = ai.chat_max_tokens;
    reasoningEffort = ai.chat_reasoning_effort;
    // Las propuestas nacen sabiendo reglas/aprendizajes guardados (flywheel).
    memory = memoryOptionsFromConfig(ai, 'system');
  } catch {
    // sin store-config: se cae a los defaults del chat-client.
  }

  const { created, agentKeys, engine } = await generateProposals({
    container,
    service,
    limit: proposalsLimit,
    // Con un agente elegido se saltea el triage y se corre SÓLO ese (diagnóstico).
    agentKey: proposalsAgent || undefined,
    createdBy: 'system',
    model,
    maxTokens,
    reasoningEffort,
    memory,
    log: (msg) => logger.info(`[proposals cron] ${msg}`),
  });

  if (created.length === 0) {
    logger.info('[proposals cron] El análisis no generó propuestas.');
    return;
  }
  logger.info(
    `[proposals cron] ${created.length} propuestas creadas (motor ${engine}) por ${agentKeys.length} agente(s): ${agentKeys.join(', ')}.`,
  );
}

export const config = {
  name: 'generate-ai-proposals',
  // Diaria 06:00. `AI_PROPOSALS_CRON` es `envOnly` en el descriptor: Medusa hornea
  // este valor al arrancar y no hay forma de reprogramarlo en runtime.
  schedule: process.env.AI_PROPOSALS_CRON || '0 6 * * *',
};
