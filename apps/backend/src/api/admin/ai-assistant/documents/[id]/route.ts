import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../modules/ai-assistant';
import { deleteDocument, type MemoryStore } from '../../../../../modules/ai-assistant/ai/memory';

type AiService = any;
const TENANT = 'default';

/** DELETE /admin/ai-assistant/documents/:id — borra el documento y sus chunks. */
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const id = req.params.id as string;
  const doc = await service.retrieveMemoryDocument(id).catch(() => null);
  if (!doc || doc.tenant_id !== TENANT) {
    res.status(404).json({ message: 'Documento no encontrado.' });
    return;
  }
  await deleteDocument(service as MemoryStore, id);
  res.json({ id, deleted: true });
};
