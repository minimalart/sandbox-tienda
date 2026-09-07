import { model } from '@medusajs/framework/utils';

/**
 * Corrida de un workflow: el ESTADO COMPARTIDO + el CHECKLIST de pasos que el
 * Orquestador mantiene. El motor lo persiste a medida que avanza, así la UI
 * muestra el progreso (y queda al recargar) y se puede reanudar tras un HITL.
 *
 * - `input`: parámetros con los que el Orquestador arrancó el workflow.
 * - `state`: blackboard compartido — acumula el resultado estructurado de cada
 *   paso bajo su `output_key`/`key` (los pasos siguientes lo referencian).
 * - `checklist`: Array<{ key, agent_key, label, status, result_summary? }> con
 *   status 'pending' | 'in_progress' | 'completed' | 'needs_input' | 'failed'.
 */
export const WorkflowRun = model.define('ai_workflow_run', {
  id: model.id().primaryKey(),
  workflow_key: model.text(),
  thread_id: model.text().nullable(),
  status: model
    .enum(['running', 'needs_input', 'completed', 'failed'])
    .default('running'),
  input: model.json().nullable(),
  state: model.json().nullable(),
  checklist: model.json().nullable(),
  error: model.text().nullable(),
  created_by: model.text().nullable(),
  completed_at: model.dateTime().nullable(),
});
