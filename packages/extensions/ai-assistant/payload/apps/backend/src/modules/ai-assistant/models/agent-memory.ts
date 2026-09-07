import { model } from '@medusajs/framework/utils';

/**
 * Memoria vectorizada del Asistente IA: aprendizajes de negocio, decisiones,
 * reglas comerciales, contexto de catálogo/marca/segmentos, feedback de
 * propuestas y chunks de documentos cargados por agente. Es la "memoria de largo
 * plazo" que se recupera por similitud semántica y se inyecta al prompt antes de
 * que el agente responda (ver `ai/memory.ts` y la inyección en `ai/agent.ts`).
 *
 * IMPORTANTE — columna `embedding`: Medusa `model.define()` NO tiene tipo `vector`,
 * así que la columna `embedding vector(1536)` NO se declara acá; se agrega NULLABLE
 * por SQL crudo en la migración y se lee/escribe por knex (`embedding <=> $1`). El
 * resto de las columnas sí las maneja el CRUD autogenerado de `MedusaService`.
 *
 * - `tenant_id`: forward-compat (hoy single-store, default 'default'); SIEMPRE se
 *   filtra por él en cada query.
 * - `agent_key`: null = memoria global de la tienda (la ven todos los agentes);
 *   con valor = específica de ese agente.
 * - `status`: estado lógico para el retrieval (`pending` = auto-capturada esperando
 *   aprobación; `active` = recuperable; `archived` = fuera del retrieval). El borrado
 *   físico va por `deleted_at` (soft-delete del CRUD de Medusa), no por este enum.
 * - `source` + `source_ref_id`: origen (thread_id, proposal_id, document_id).
 * - `embedding_model`: modelo con el que se embebió (versionado por fila).
 */
export const AgentMemory = model.define('ai_agent_memory', {
  id: model.id().primaryKey(),
  tenant_id: model.text().default('default'),
  agent_key: model.text().nullable(),
  memory_type: model.enum([
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
  ]),
  entity_type: model.text().nullable(),
  entity_id: model.text().nullable(),
  title: model.text(),
  content: model.text(),
  summary: model.text().nullable(),
  // embedding vector(1536) → se agrega por SQL crudo en la migración (ver arriba).
  embedding_model: model.text().nullable(),
  embedded_at: model.dateTime().nullable(),
  metadata: model.json().nullable(),
  tags: model.json().nullable(),
  source: model.enum(['manual', 'conversation', 'proposal', 'document', 'system']).default('manual'),
  source_ref_id: model.text().nullable(),
  importance_score: model.number().default(50),
  confidence_score: model.number().default(70),
  status: model.enum(['pending', 'active', 'archived']).default('active'),
  created_by: model.text().nullable(),
  last_used_at: model.dateTime().nullable(),
  usage_count: model.number().default(0),
});
