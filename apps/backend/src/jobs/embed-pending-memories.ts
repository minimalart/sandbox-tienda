import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { AI_ASSISTANT_MODULE } from '../modules/ai-assistant';
import { STORE_CONFIG_MODULE } from '../modules/store-config';
import type StoreConfigModuleService from '../modules/store-config/service';
import { isEmbeddingConfigured } from '../modules/ai-assistant/ai/embedding-client';
import {
  embedPendingMemories,
  refreshDocumentStatuses,
  type MemoryStore,
} from '../modules/ai-assistant/ai/memory';

const BATCH = 64;
const MAX_BATCHES = 10; // drena hasta ~640 filas por corrida

/**
 * Job de embeddings pendientes: embebe las memorias con `embedding IS NULL`
 * (chunks recién ingestados que no se embebieron inline) o con un modelo de
 * embedding viejo (re-embed tras cambiar `EMBEDDINGS_MODEL`), y marca como `ready`
 * los documentos cuyos chunks ya están todos embebidos. Se saltea si la memoria
 * está deshabilitada o falta la API key.
 */
export default async function embedPendingMemoriesJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  if (!isEmbeddingConfigured()) return;

  try {
    const storeConfig: StoreConfigModuleService = container.resolve(STORE_CONFIG_MODULE);
    const ai = await storeConfig.getAiConfig();
    if (!ai.memory_enabled) return; // memoria apagada: nada que hacer
  } catch {
    // sin store-config: seguimos (defaults), no bloquea el embed
  }

  const service: any = container.resolve(AI_ASSISTANT_MODULE);
  let total = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const n = await embedPendingMemories(service as MemoryStore, { batchSize: BATCH });
    total += n;
    if (n < BATCH) break; // no quedan más pendientes
  }
  await refreshDocumentStatuses(service as MemoryStore);
  if (total > 0) logger.info(`[memory] ${total} memorias embebidas.`);
}

export const config = {
  name: 'embed-pending-memories',
  // `AI_MEMORY_EMBED_CRON` es `envOnly` en `descriptors/ai-assistant.ts`: Medusa
  // lee este `schedule:` al arrancar y no hay forma de reprogramarlo en runtime.
  // El interruptor que SÍ es de base (`ai_config.memory_enabled`) se evalúa arriba,
  // dentro del cuerpo, así que apagar la memoria tiene efecto en la corrida siguiente.
  schedule: process.env.AI_MEMORY_EMBED_CRON || '*/3 * * * *',
};
