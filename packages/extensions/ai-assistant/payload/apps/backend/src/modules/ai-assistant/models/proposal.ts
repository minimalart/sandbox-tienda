import { model } from '@medusajs/framework/utils';

/**
 * Propuesta accionable generada por un agente (spine del HITL proactivo). Un
 * agente analista corriendo en un job deja Propuestas con diagnóstico + evidencia
 * (cifras de las tools) + acciones propuestas; un humano las revisa y, al aprobar,
 * se ejecutan las `proposed_actions` por el mismo `execTool` gateado por políticas.
 *
 * - `proposed_actions`: `[{ tool, args, label? }]` — tool calls del MCP listos
 *   para ejecutar (los `args` incluyen `action`/`resource`). Puede ir vacío: en ese
 *   caso la propuesta es solo asesora (el humano actúa a mano).
 * - `expected_impact`: estimación opcional (JSON libre) para mostrar en la UI.
 * - `status`: pending (a revisar) → approved/rejected; al ejecutar → executed/failed.
 * - `source`: `proactive` (job) o `chat` (sugerida en una conversación).
 * - `execution_result`: resultado por acción tras aprobar (JSON).
 */
export const Proposal = model.define('ai_proposal', {
  id: model.id().primaryKey(),
  agent_key: model.text(),
  thread_id: model.text().nullable(),
  title: model.text(),
  summary: model.text(),
  rationale: model.text().nullable(),
  proposed_actions: model.json().nullable(),
  expected_impact: model.json().nullable(),
  status: model
    .enum(['draft', 'pending', 'approved', 'rejected', 'executed', 'failed'])
    .default('pending'),
  source: model.enum(['proactive', 'chat']).default('proactive'),
  created_by: model.text().nullable(),
  reviewed_by: model.text().nullable(),
  execution_result: model.json().nullable(),
});
