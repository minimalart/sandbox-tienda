import { model } from '@medusajs/framework/utils';

/**
 * Skill reutilizable: un bloque de instrucciones (enfoque/heurísticas) que se
 * adjunta a uno o varios agentes (ver `Agent.skills`). Migra los skills que hoy
 * viven hardcodeados en `ai/prompt.ts` (ventas, productos, clientes, ordenes,
 * promociones) a filas editables y compartibles entre agentes.
 *
 * - `key`: slug estable que referencia `Agent.skills` (p. ej. 'ventas').
 * - `instructions`: el texto que se inyecta al contexto del agente.
 */
export const Skill = model.define('ai_skill', {
  id: model.id().primaryKey(),
  key: model.text(),
  name: model.text(),
  instructions: model.text(),
  enabled: model.boolean().default(true),
});
