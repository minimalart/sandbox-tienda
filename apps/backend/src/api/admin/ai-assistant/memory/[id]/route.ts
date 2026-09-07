import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../modules/ai-assistant';
import { reembedMemory, type MemoryStore } from '../../../../../modules/ai-assistant/ai/memory';
import type { AdminUpdateMemoryType } from '../../validators';

type AiService = any;

/** GET /admin/ai-assistant/memory/:id — detalle. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const memory = await service.retrieveAgentMemory(req.params.id).catch(() => null);
  if (!memory) {
    res.status(404).json({ message: 'Memoria no encontrada.' });
    return;
  }
  res.json({ memory });
};

/** POST /admin/ai-assistant/memory/:id — actualiza (editar / archivar / aprobar). */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateMemoryType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const id = req.params.id as string;
  const body = req.validatedBody;
  const current = await service.retrieveAgentMemory(id).catch(() => null);
  if (!current) {
    res.status(404).json({ message: 'Memoria no encontrada.' });
    return;
  }

  const patch: Record<string, any> = { id };
  for (const k of ['title', 'content', 'summary', 'memory_type', 'agent_key', 'tags', 'importance_score', 'confidence_score', 'status'] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  const memory = await service.updateAgentMemories(patch);

  // Si cambió el contenido/resumen, re-embebemos para mantener la búsqueda al día.
  if (body.content !== undefined || body.summary !== undefined) {
    const text = (body.summary ?? current.summary)?.trim() || (body.content ?? current.content);
    if (text) await reembedMemory(service as MemoryStore, id, text);
  }
  res.json({ memory });
};

/** DELETE /admin/ai-assistant/memory/:id — soft-delete. */
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  await service.deleteAgentMemories(req.params.id);
  res.json({ id: req.params.id, deleted: true });
};
