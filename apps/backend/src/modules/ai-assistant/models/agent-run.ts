import { model } from '@medusajs/framework/utils';

/**
 * Traza de una corrida del agente: un turno del chat, una corrida del analista
 * proactivo, o la ejecución de una Propuesta aprobada. Agrega tokens, pasos y
 * duración para la pantalla de observabilidad. Lo emite el `RunTracer`
 * (ver `ai/tracing.ts`); la escritura es best-effort y nunca rompe el turno.
 */
export const AgentRun = model.define('ai_agent_run', {
  id: model.id().primaryKey(),
  thread_id: model.text().nullable(),
  agent_key: model.text(),
  kind: model.enum(['chat', 'proactive', 'proposal_exec']).default('chat'),
  status: model.enum(['running', 'complete', 'needs_approval', 'error']).default('running'),
  model: model.text().nullable(),
  steps: model.number().default(0),
  prompt_tokens: model.number().default(0),
  completion_tokens: model.number().default(0),
  duration_ms: model.number().nullable(),
  error: model.text().nullable(),
  created_by: model.text().nullable(),
  // Veredicto de grounding (anti-alucinación) si la validación está activa:
  // { grounded: boolean, score: 0..1, issues: string[] }. Null si no se validó.
  groundedness: model.json().nullable(),
  // IDs de memorias (`ai_agent_memory`) inyectadas en el system prompt de esta
  // corrida. Auditoría: qué memoria influyó en la respuesta. Null/[] si ninguna.
  injected_memory_ids: model.json().nullable(),
});
