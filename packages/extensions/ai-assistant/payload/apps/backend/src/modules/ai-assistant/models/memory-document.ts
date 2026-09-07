import { model } from '@medusajs/framework/utils';

/**
 * Documento de contexto cargado por agente desde el backoffice (PDF, txt, md). Se
 * parsea a texto, se chunkea y cada chunk se persiste como una fila de
 * `ai_agent_memory` (`memory_type='document_chunk'`, `source='document'`,
 * `source_ref_id=<este id>`, `agent_key` heredado). Esta tabla guarda el documento
 * "padre" para poder re-chunkear sin re-parsear y para mostrar estado de ingesta.
 *
 * No persistimos el binario original (privacidad + evita signed URLs de S3):
 * guardamos el texto extraído en `content`. `content_hash` deduplica y detecta
 * cambios (re-subir el mismo archivo no re-ingesta; uno distinto re-chunkea).
 *
 * - `agent_key`: null = contexto global (lo leen todos los agentes).
 * - `status`: `processing` (chunks insertados, faltan embeddings) → `ready` (todos
 *   los chunks embebidos) → `failed` (no se pudo extraer texto, p.ej. PDF escaneado).
 */
export const MemoryDocument = model.define('ai_memory_document', {
  id: model.id().primaryKey(),
  tenant_id: model.text().default('default'),
  agent_key: model.text().nullable(),
  title: model.text(),
  original_filename: model.text().nullable(),
  mime_type: model.text(),
  content: model.text(),
  content_hash: model.text(),
  char_count: model.number().default(0),
  chunk_count: model.number().default(0),
  status: model.enum(['processing', 'ready', 'failed']).default('processing'),
  error: model.text().nullable(),
  created_by: model.text().nullable(),
});
