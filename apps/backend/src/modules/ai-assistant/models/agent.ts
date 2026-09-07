import { model } from '@medusajs/framework/utils';

/**
 * Definición declarativa de un agente (un "manifiesto", no código): instrucciones,
 * modelo, skills adjuntos, allow-list de tools/resources del MCP y targets de
 * handoff. El gating auto/ask/prohibited lo sigue resolviendo `ai/policy.ts`
 * (ToolPolicy global); el allow-list solo acota QUÉ tools VE este agente
 * (efectivo = allow-list ∩ no-prohibido-global). Un agente nunca afloja políticas.
 *
 * - `allowed_tools`: null = todas las tools (menos las prohibidas globalmente);
 *   si tiene valor, `[{ tool, resources?, actions? }]` acota la superficie.
 * - `skills`: array de `Skill.key` que se inyectan al system prompt del agente.
 * - `handoff_targets`: array de `Agent.key` a los que este agente puede derivar.
 * - `model`/`max_tokens`/`reasoning_effort`: null = usa el default de store-config.
 * - `is_orchestrator`: el agente por el que arranca un hilo nuevo y que deriva al
 *   resto (puede haber solo uno efectivo; el loader toma el de menor `rank`).
 * - `source`: `system` (sembrado), `custom` (creado en el backoffice) o
 *   `thirdparty` (importado como extensión).
 */
export const Agent = model.define('ai_agent', {
  id: model.id().primaryKey(),
  key: model.text(),
  name: model.text(),
  description: model.text().nullable(),
  instructions: model.text(),
  model: model.text().nullable(),
  max_tokens: model.number().nullable(),
  reasoning_effort: model.enum(['minimal', 'low', 'medium', 'high']).nullable(),
  enabled: model.boolean().default(true),
  is_orchestrator: model.boolean().default(false),
  rank: model.number().default(0),
  // `icon`: legado (emoji). El avatar ahora es una foto subida al bucket (`avatar_url`).
  icon: model.text().nullable(),
  avatar_url: model.text().nullable(),
  allowed_tools: model.json().nullable(),
  skills: model.json().nullable(),
  handoff_targets: model.json().nullable(),
  // `memory_types`: array de `memory_type` que este agente recupera de la memoria
  // (ver `ai_agent_memory`). null = default sensato (todos menos `document_chunk`,
  // que solo entra por búsqueda explícita). Los `document_chunk` propios del agente
  // (su contexto cargado) siempre se recuperan para él.
  memory_types: model.json().nullable(),
  source: model.enum(['system', 'custom', 'thirdparty']).default('system'),
});
