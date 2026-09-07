import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../modules/ai-assistant';
import {
  embedText,
  retrieveMemories,
  ALL_MEMORY_TYPES,
  type MemoryStore,
} from '../../../../../modules/ai-assistant/ai/memory';
import type { AdminSearchMemoryType } from '../../validators';

type AiService = any;
const TENANT = 'default';

/** POST /admin/ai-assistant/memory/search — búsqueda semántica (texto → embed → topK). */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSearchMemoryType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const { query, agent_key, memory_types, limit } = req.validatedBody;
  try {
    const embedding = await embedText(query);
    const results = await retrieveMemories(service as MemoryStore, {
      tenantId: TENANT,
      agentKey: agent_key ?? null,
      memoryTypes: memory_types && memory_types.length > 0 ? memory_types : [...ALL_MEMORY_TYPES],
      queryEmbedding: embedding,
      topK: limit ?? 10,
      minSimilarity: 0, // en búsqueda manual mostramos todo lo que matchee, ordenado
    });
    res.json({ results });
  } catch (e) {
    res.status(502).json({ message: (e as Error).message });
  }
};
