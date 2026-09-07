import { embedText, embedTexts, getEmbeddingModelName } from './embedding-client';
import type { MemoryConfigInput, MemoryRuntimeOptions } from './types';
import { sha256 } from './document-parse';

/**
 * Núcleo de la memoria vectorizada. Separa las partes PURAS (chunkText,
 * buildRetrievalQuery, rankAndFilter, serializeVector — testeables sin DB ni red)
 * de las de I/O (retrieveMemories, saveMemory, touchMemories, embedPendingMemories),
 * que usan el knex del módulo y el cliente de embeddings.
 *
 * La columna `embedding vector(1536)` no la conoce el ORM de Medusa: se lee/escribe
 * por SQL crudo (`embedding <=> $1`, `?::vector`). Todo el I/O es best-effort: un
 * fallo de embedding deja la fila con `embedding NULL` (el job la levanta) y nunca
 * rompe el turno del chat ni la subida de un documento.
 */

export const ALL_MEMORY_TYPES = [
  'business_rule',
  'decision',
  'preference',
  'campaign_learning',
  'product_context',
  'customer_segment_context',
  'brand_guideline',
  'operational_policy',
  'conversation_learning',
  'proposal_feedback',
  'document_chunk',
  'faq',
  'system_note',
] as const;

export type MemoryType = (typeof ALL_MEMORY_TYPES)[number];

/** Default de tipos que recupera un agente: todos menos los chunks de documentos
 * (esos entran por su propio agent_key o por búsqueda explícita). */
export const DEFAULT_MEMORY_TYPES: MemoryType[] = ALL_MEMORY_TYPES.filter(
  (t) => t !== 'document_chunk',
);

export type MemorySource = 'manual' | 'conversation' | 'proposal' | 'document' | 'system';
export type MemoryStatus = 'pending' | 'active' | 'archived';

/** Forma mínima del store (la cumple el service del módulo). Estructural para no
 * crear import circular con `agent.ts`. El knex sale de `__container__`. */
export type MemoryStore = {
  createAgentMemories(data: any): Promise<any>;
  updateAgentMemories(data: any): Promise<any>;
  listAgentMemories(filters?: any, config?: any): Promise<any[]>;
  createMemoryDocuments(data: any): Promise<any>;
  updateMemoryDocuments(data: any): Promise<any>;
  listMemoryDocuments(filters?: any, config?: any): Promise<any[]>;
};

function getKnex(store: MemoryStore): any {
  return (store as any).__container__.manager.getKnex();
}

// ─── Partes puras ─────────────────────────────────────────────────────────────

/**
 * Parte un texto largo en chunks por límite de caracteres, respetando párrafos.
 * Un párrafo más largo que `maxChars` se corta por ventanas con `overlap`.
 */
export function chunkText(
  text: string,
  { maxChars = 1500, overlap = 150 }: { maxChars?: number; overlap?: number } = {},
): string[] {
  const clean = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const paras = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let cur = '';
  const flush = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = '';
  };
  const step = Math.max(1, maxChars - overlap);

  for (const para of paras) {
    if (para.length > maxChars) {
      flush();
      for (let i = 0; i < para.length; i += step) {
        chunks.push(para.slice(i, i + maxChars));
      }
      continue;
    }
    if (cur && cur.length + 2 + para.length > maxChars) flush();
    cur = cur ? `${cur}\n\n${para}` : para;
  }
  flush();
  return chunks;
}

/** Serializa un vector a literal pgvector (`[0.1,0.2,...]`) para castear text→vector. */
export function serializeVector(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

/**
 * Arma la query de similitud (placeholders `?` para `knex.raw`). Filtra por tenant,
 * status active, no borradas, tipos pedidos y scope (global ∪ agente). Orden por
 * distancia coseno ascendente. PURA y testeable.
 */
export function buildRetrievalQuery(opts: {
  tenantId: string;
  agentKey: string | null;
  memoryTypes: string[];
  embeddingLiteral: string;
  limit: number;
}): { sql: string; bindings: unknown[] } {
  const { tenantId, agentKey, memoryTypes, embeddingLiteral, limit } = opts;
  const typePlaceholders = memoryTypes.map(() => '?').join(', ');
  const agentClause = agentKey ? '(agent_key is null or agent_key = ?)' : 'agent_key is null';
  const sql = `select id, title, content, summary, memory_type, importance_score,
       1 - (embedding <=> ?) as similarity
from ai_agent_memory
where deleted_at is null and status = 'active' and tenant_id = ?
  and embedding is not null
  and memory_type in (${typePlaceholders})
  and ${agentClause}
order by embedding <=> ? limit ?`;
  const bindings: unknown[] = [embeddingLiteral, tenantId, ...memoryTypes];
  if (agentKey) bindings.push(agentKey);
  bindings.push(embeddingLiteral, limit);
  return { sql, bindings };
}

export type MemoryCandidate = {
  id: string;
  title: string;
  content: string;
  summary?: string | null;
  memory_type: string;
  importance_score?: number | null;
  similarity?: number | null;
};

export type RankedMemory = {
  id: string;
  memory_type: string;
  title: string;
  text: string;
  similarity: number;
};

const estimateTokens = (s: string): number => Math.ceil(s.length / 4);

/**
 * Filtra por similitud mínima, puntúa (similitud×0.7 + importancia×0.3), dedup por
 * título, y corta por topK y presupuesto de tokens. Devuelve las memorias elegidas
 * con el snippet a inyectar. PURA y testeable.
 */
export function rankAndFilter(
  rows: MemoryCandidate[],
  {
    minSimilarity = 0.35,
    topK = 5,
    tokenBudget = 1000,
    snippetChars = 600,
  }: { minSimilarity?: number; topK?: number; tokenBudget?: number; snippetChars?: number } = {},
): RankedMemory[] {
  const scored = rows
    .map((r) => {
      const similarity = typeof r.similarity === 'number' ? r.similarity : 0;
      const importance = typeof r.importance_score === 'number' ? r.importance_score : 50;
      const score = similarity * 0.7 + (importance / 100) * 0.3;
      return { row: r, similarity, score };
    })
    .filter((x) => x.similarity >= minSimilarity)
    .sort((a, b) => b.score - a.score);

  const out: RankedMemory[] = [];
  const seenTitles = new Set<string>();
  let tokens = 0;

  for (const { row, similarity } of scored) {
    if (out.length >= topK) break;
    const titleKey = row.title.trim().toLowerCase();
    if (seenTitles.has(titleKey)) continue;
    const body = row.summary && row.summary.trim() ? row.summary.trim() : row.content;
    const snippet = body.length > snippetChars ? `${body.slice(0, snippetChars)}…` : body;
    const text = `(${row.memory_type}) ${row.title}: ${snippet}`;
    const cost = estimateTokens(text);
    if (tokens + cost > tokenBudget && out.length > 0) break;
    seenTitles.add(titleKey);
    tokens += cost;
    out.push({ id: row.id, memory_type: row.memory_type, title: row.title, text, similarity });
  }
  return out;
}

// ─── I/O (best-effort) ──────────────────────────────────────────────────────────

/**
 * Recupera memorias relevantes por similitud + filtros. Devuelve las elegidas
 * (rankeadas) o `[]` ante cualquier error (best-effort: nunca rompe el turno).
 */
export async function retrieveMemories(
  store: MemoryStore,
  opts: {
    tenantId: string;
    agentKey: string | null;
    memoryTypes: string[];
    queryEmbedding: number[];
    topK?: number;
    minSimilarity?: number;
    tokenBudget?: number;
  },
): Promise<RankedMemory[]> {
  const { tenantId, agentKey, memoryTypes, queryEmbedding } = opts;
  const topK = opts.topK ?? 5;
  if (!memoryTypes.length || !queryEmbedding.length) return [];
  try {
    const knex = getKnex(store);
    const { sql, bindings } = buildRetrievalQuery({
      tenantId,
      agentKey,
      memoryTypes,
      embeddingLiteral: serializeVector(queryEmbedding),
      // Traemos más que topK para que rankAndFilter pueda filtrar/dedup y recortar.
      limit: Math.max(topK * 3, topK),
    });
    const result = await knex.raw(sql, bindings);
    const rows: MemoryCandidate[] = result?.rows ?? result ?? [];
    return rankAndFilter(rows, {
      topK,
      minSimilarity: opts.minSimilarity,
      tokenBudget: opts.tokenBudget,
    });
  } catch {
    return [];
  }
}

export type SaveMemoryInput = {
  tenantId?: string;
  agentKey?: string | null;
  memoryType: MemoryType;
  title: string;
  content: string;
  summary?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: any;
  tags?: string[] | null;
  source: MemorySource;
  sourceRefId?: string | null;
  importanceScore?: number;
  confidenceScore?: number;
  status?: MemoryStatus;
  createdBy?: string | null;
};

/**
 * Crea una memoria (fila por CRUD) y luego embebe su texto y guarda el vector por
 * knex (2 pasos, como vimeo-video). Si el embedding falla, la fila queda con
 * `embedding NULL` (el job la levanta). Devuelve la fila creada o null si todo falla.
 */
export async function saveMemory(store: MemoryStore, input: SaveMemoryInput): Promise<any | null> {
  let row: { id: string } | null = null;
  try {
    row = await store.createAgentMemories({
      tenant_id: input.tenantId ?? 'default',
      agent_key: input.agentKey ?? null,
      memory_type: input.memoryType,
      title: input.title,
      content: input.content,
      summary: input.summary ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? null,
      tags: input.tags ?? null,
      source: input.source,
      source_ref_id: input.sourceRefId ?? null,
      importance_score: input.importanceScore ?? 50,
      confidence_score: input.confidenceScore ?? 70,
      status: input.status ?? 'active',
      created_by: input.createdBy ?? null,
    });
  } catch {
    return null;
  }
  if (!row?.id) return row;
  await embedAndStore(store, [{ id: row.id, text: input.summary?.trim() || input.content }]);
  return row;
}

/** Embebe y guarda el vector de un set de filas (best-effort). */
async function embedAndStore(
  store: MemoryStore,
  items: Array<{ id: string; text: string }>,
): Promise<number> {
  if (!items.length) return 0;
  try {
    const knex = getKnex(store);
    const vectors = await embedTexts(items.map((i) => i.text));
    const model = getEmbeddingModelName();
    let n = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const vec = vectors[i];
      if (!item || !vec) continue;
      await knex('ai_agent_memory')
        .where({ id: item.id })
        .update({
          embedding: knex.raw('?::vector', [serializeVector(vec)]),
          embedding_model: model,
          embedded_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        });
      n++;
    }
    return n;
  } catch {
    return 0; // best-effort: quedan con embedding NULL para el job
  }
}

/** Re-embebe una memoria (p. ej. al editar su contenido desde la UI). Best-effort. */
export async function reembedMemory(store: MemoryStore, id: string, text: string): Promise<void> {
  await embedAndStore(store, [{ id, text }]);
}

/** Incrementa usage_count y last_used_at de las memorias inyectadas. Best-effort. */
export async function touchMemories(store: MemoryStore, ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const knex = getKnex(store);
    await knex('ai_agent_memory')
      .whereIn('id', ids)
      .update({ usage_count: knex.raw('usage_count + 1'), last_used_at: knex.fn.now() });
  } catch {
    // best-effort
  }
}

/**
 * Embebe filas pendientes (`embedding IS NULL`) o con un modelo de embedding viejo
 * (re-embed por cambio de modelo). Lo usa el job `embed-pending-memories`. Devuelve
 * cuántas embebió. Best-effort.
 */
export async function embedPendingMemories(
  store: MemoryStore,
  { batchSize = 64 }: { batchSize?: number } = {},
): Promise<number> {
  try {
    const knex = getKnex(store);
    const model = getEmbeddingModelName();
    const rows: Array<{ id: string; content: string; summary: string | null }> = await knex(
      'ai_agent_memory',
    )
      .select('id', 'content', 'summary')
      .whereNull('deleted_at')
      .whereNot('status', 'archived')
      .where((qb: { whereNull: (c: string) => unknown; orWhereNot: (c: string, v: string) => unknown }) => {
        qb.whereNull('embedding');
        qb.orWhereNot('embedding_model', model);
      })
      .limit(batchSize);
    if (!rows.length) return 0;
    return embedAndStore(
      store,
      rows.map((r) => ({ id: r.id, text: (r.summary?.trim() || r.content) ?? '' })),
    );
  } catch {
    return 0;
  }
}

// ─── Documentos (contexto por agente) ────────────────────────────────────────

/** Hasta cuántos chunks se embeben en el mismo request del upload (el resto lo
 * toma el job para no bloquear). */
const INLINE_EMBED_MAX_CHUNKS = 40;

export type IngestDocumentInput = {
  tenantId?: string;
  agentKey?: string | null;
  title: string;
  originalFilename?: string | null;
  mimeType: string;
  text: string;
  createdBy?: string | null;
};

/**
 * Ingesta un documento ya parseado a texto: dedup por hash, crea la fila padre,
 * chunkea, inserta cada chunk como memoria `document_chunk` y embebe inline los
 * primeros (el resto lo toma el job). Devuelve la fila del documento. Si el texto
 * está vacío (p. ej. PDF escaneado), el doc queda `failed`.
 */
export async function ingestDocument(store: MemoryStore, input: IngestDocumentInput): Promise<any> {
  const tenantId = input.tenantId ?? 'default';
  const agentKey = input.agentKey ?? null;
  const text = (input.text ?? '').trim();
  const contentHash = sha256(`${agentKey ?? 'global'}:${text}`);

  // Dedup: mismo archivo (hash) para el mismo agente → no re-ingesta.
  try {
    const existing = await store.listMemoryDocuments(
      { tenant_id: tenantId, content_hash: contentHash },
      { take: 1 },
    );
    if (existing[0]) return existing[0];
  } catch {
    // si falla el lookup, seguimos creando
  }

  if (!text) {
    return store.createMemoryDocuments({
      tenant_id: tenantId,
      agent_key: agentKey,
      title: input.title,
      original_filename: input.originalFilename ?? null,
      mime_type: input.mimeType,
      content: '',
      content_hash: contentHash,
      char_count: 0,
      chunk_count: 0,
      status: 'failed',
      error: 'No se pudo extraer texto del archivo (¿PDF escaneado o vacío?).',
      created_by: input.createdBy ?? null,
    });
  }

  const doc = await store.createMemoryDocuments({
    tenant_id: tenantId,
    agent_key: agentKey,
    title: input.title,
    original_filename: input.originalFilename ?? null,
    mime_type: input.mimeType,
    content: text,
    content_hash: contentHash,
    char_count: text.length,
    chunk_count: 0,
    status: 'processing',
    created_by: input.createdBy ?? null,
  });

  const chunks = chunkText(text);
  const created: Array<{ id: string; text: string }> = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    try {
      const row = await store.createAgentMemories({
        tenant_id: tenantId,
        agent_key: agentKey,
        memory_type: 'document_chunk',
        title: `${input.title} (parte ${i + 1}/${chunks.length})`,
        content: chunk,
        source: 'document',
        source_ref_id: doc.id,
        metadata: { doc_id: doc.id, chunk_index: i },
        status: 'active',
        created_by: input.createdBy ?? null,
      });
      if (row?.id) created.push({ id: row.id, text: chunk });
    } catch {
      // un chunk que falla no aborta la ingesta
    }
  }

  await store.updateMemoryDocuments({ id: doc.id, chunk_count: created.length });

  // Embebemos inline los primeros chunks; el resto queda con embedding NULL para el job.
  if (created.length > 0 && created.length <= INLINE_EMBED_MAX_CHUNKS) {
    const n = await embedAndStore(store, created);
    if (n === created.length) {
      await store.updateMemoryDocuments({ id: doc.id, status: 'ready' });
      return { ...doc, chunk_count: created.length, status: 'ready' };
    }
  }
  return { ...doc, chunk_count: created.length };
}

/**
 * Marca como `ready` los documentos `processing` cuyos chunks ya están todos
 * embebidos. Lo llama el job tras embeber pendientes. Best-effort.
 */
export async function refreshDocumentStatuses(store: MemoryStore): Promise<void> {
  try {
    const knex = getKnex(store);
    await knex.raw(`
      update "ai_memory_document" d
      set status = 'ready', updated_at = now()
      where d.status = 'processing' and d.deleted_at is null
        and exists (
          select 1 from "ai_agent_memory" m
          where m.source_ref_id = d.id and m.deleted_at is null
        )
        and not exists (
          select 1 from "ai_agent_memory" m2
          where m2.source_ref_id = d.id and m2.deleted_at is null and m2.embedding is null
        )
    `);
  } catch {
    // best-effort
  }
}

/** Soft-delete de un documento y de todos sus chunks. Best-effort. */
export async function deleteDocument(store: MemoryStore, docId: string): Promise<void> {
  try {
    const knex = getKnex(store);
    await knex('ai_agent_memory')
      .where({ source_ref_id: docId })
      .whereNull('deleted_at')
      .update({ deleted_at: knex.fn.now() });
    await knex('ai_memory_document').where({ id: docId }).update({ deleted_at: knex.fn.now() });
  } catch {
    // best-effort
  }
}

export { embedText };

/** Construye las opciones de memoria del turno desde la config de store-config. */
export function memoryOptionsFromConfig(
  ai: MemoryConfigInput,
  createdBy?: string | null,
): MemoryRuntimeOptions {
  return {
    enabled: ai.memory_enabled,
    autocaptureEnabled: ai.memory_autocapture_enabled,
    autocaptureRequiresApproval: ai.memory_autocapture_requires_approval,
    topK: ai.memory_retrieval_topk,
    minSimilarity: ai.memory_min_similarity,
    // Single-store: tenant constante (forward-compat). Multi-store = resolver acá.
    tenantId: 'default',
    createdBy: createdBy ?? null,
  };
}
