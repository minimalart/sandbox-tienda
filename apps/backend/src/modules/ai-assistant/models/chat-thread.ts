import { model } from '@medusajs/framework/utils';

/**
 * Hilo de conversación del Asistente IA. Scoped por `created_by` (id del usuario
 * admin que lo creó) para que cada quien vea sus propios hilos.
 *
 * `active_agent_id`: agente que está atendiendo el hilo. Lo setea el orquestador
 * y se actualiza en cada handoff. `null` = todavía no resuelto (el loader cae al
 * orquestador / agente por defecto).
 */
export const ChatThread = model.define('chat_thread', {
  id: model.id().primaryKey(),
  title: model.text(),
  status: model.enum(['active', 'archived']).default('active'),
  created_by: model.text(),
  active_agent_id: model.text().nullable(),
});
