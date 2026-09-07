import { model } from '@medusajs/framework/utils';

/**
 * Definición de un WORKFLOW orquestado: una secuencia de pasos donde cada paso
 * despacha a un subagente (headless) con una tarea. El Orquestador elige qué
 * workflow correr; el motor (`ai/workflow-engine.ts`) ejecuta los pasos en orden
 * (en paralelo los que comparten `parallel_group`) de forma determinística.
 *
 * - `steps`: Array<{ key, agent_key, task, parallel_group?, requires_approval?, output_key? }>.
 *   `task` es un template que puede referenciar {{input.*}} y {{state.<stepKey>.*}}.
 * - `final_action`: { type: 'none' | 'confirm' | ... } — qué hace el Orquestador al cerrar.
 * - `source`: 'system' (seedeado) | 'custom' (creado desde la UI).
 */
export const WorkflowDefinition = model.define('ai_workflow', {
  id: model.id().primaryKey(),
  key: model.text(),
  name: model.text(),
  description: model.text().nullable(),
  enabled: model.boolean().default(true),
  steps: model.json(),
  final_action: model.json().nullable(),
  source: model.enum(['system', 'custom']).default('custom'),
  created_by: model.text().nullable(),
});
