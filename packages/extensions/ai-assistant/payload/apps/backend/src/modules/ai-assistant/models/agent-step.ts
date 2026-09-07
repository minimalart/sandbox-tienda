import { model } from '@medusajs/framework/utils';

/**
 * Un paso dentro de una `AgentRun`: una llamada al modelo (`model`), una ejecución
 * de tool (`tool`) o un handoff (`handoff`). Guarda nombre, estado, duración,
 * tokens y un `detail` libre (finish_reason, args resumidos, etc.).
 */
export const AgentStep = model.define('ai_agent_step', {
  id: model.id().primaryKey(),
  run_id: model.text().index('IDX_ai_agent_step_run_id'),
  idx: model.number().default(0),
  type: model.enum(['model', 'tool', 'handoff']),
  agent_key: model.text().nullable(),
  name: model.text().nullable(),
  status: model.text().nullable(),
  duration_ms: model.number().nullable(),
  tokens: model.number().nullable(),
  detail: model.json().nullable(),
});
