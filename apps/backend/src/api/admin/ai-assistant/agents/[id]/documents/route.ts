import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../../modules/ai-assistant';
import { ingestDocument, type MemoryStore } from '../../../../../../modules/ai-assistant/ai/memory';
import {
  extractDocumentText,
  isSupportedDocumentMime,
  UnsupportedDocumentError,
} from '../../../../../../modules/ai-assistant/ai/document-parse';
import type { AdminUploadDocumentType } from '../../../validators';

type AiService = any;
const TENANT = 'default';
const MAX_BYTES = 8 * 1024 * 1024; // 8MB de archivo (el body va en base64, ~+33%)

const DOC_COLUMNS = [
  'id',
  'agent_key',
  'title',
  'original_filename',
  'mime_type',
  'content_hash',
  'char_count',
  'chunk_count',
  'status',
  'error',
  'created_by',
  'created_at',
  'updated_at',
];

/** Resuelve el `agent_key` desde el :id de la ruta (o null para contexto global). */
async function resolveAgentKey(
  service: AiService,
  id: string | undefined,
): Promise<string | null | undefined> {
  if (!id) return undefined;
  if (id === 'global') return null;
  const agent = await service.retrieveAgent(id).catch(() => null);
  return agent ? agent.key : undefined; // undefined = no existe
}

/** GET /admin/ai-assistant/agents/:id/documents — documentos cargados de ese agente. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const agentKey = await resolveAgentKey(service, req.params.id);
  if (agentKey === undefined) {
    res.status(404).json({ message: 'Agente no encontrado.' });
    return;
  }
  const knex = (service as any).__container__.manager.getKnex();
  let qb = knex('ai_memory_document').whereNull('deleted_at').where('tenant_id', TENANT);
  qb = agentKey === null ? qb.whereNull('agent_key') : qb.where('agent_key', agentKey);
  const documents = await qb.select(DOC_COLUMNS).orderBy('created_at', 'desc').limit(200);
  res.json({ documents });
};

/** POST /admin/ai-assistant/agents/:id/documents — sube un archivo y lo ingesta. */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUploadDocumentType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const agentKey = await resolveAgentKey(service, req.params.id);
  if (agentKey === undefined) {
    res.status(404).json({ message: 'Agente no encontrado.' });
    return;
  }
  const { filename, mimeType, content, title } = req.validatedBody;
  const createdBy = req.auth_context?.actor_id ?? 'unknown';

  if (!isSupportedDocumentMime(mimeType)) {
    res.status(400).json({ message: `Tipo no soportado: ${mimeType}. Permitidos: PDF, TXT, MD.` });
    return;
  }
  const base64 = content.includes(',') ? content.slice(content.indexOf(',') + 1) : content;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) {
    res.status(400).json({ message: 'El archivo está vacío.' });
    return;
  }
  if (buffer.length > MAX_BYTES) {
    res.status(400).json({ message: 'El archivo supera el máximo de 8MB.' });
    return;
  }

  let text: string;
  try {
    text = await extractDocumentText(buffer, mimeType);
  } catch (e) {
    const status = e instanceof UnsupportedDocumentError ? 400 : 500;
    res.status(status).json({ message: (e as Error).message });
    return;
  }

  const document = await ingestDocument(service as MemoryStore, {
    tenantId: TENANT,
    agentKey,
    title: (title && title.trim()) || filename,
    originalFilename: filename,
    mimeType,
    text,
    createdBy,
  });
  res.status(201).json({ document });
};
