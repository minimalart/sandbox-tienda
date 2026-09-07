import { model } from '@medusajs/framework/utils';

/**
 * Mensaje de un hilo. Modela el formato de OpenAI/OpenRouter chat-completions
 * para poder reconstruir el historial y reanudar el loop agéntico (stateless):
 * - `role`: system|user|assistant|tool.
 * - `content`: texto (puede ser null en un assistant que solo emitió tool_calls).
 * - `tool_calls`: JSON con los tool calls que pidió el assistant.
 * - `tool_call_id`: id del tool call al que responde un mensaje `tool`.
 * - `status`: `pending` cuando el assistant propuso tool calls que requieren
 *   aprobación (modo "consulta"); `complete` cuando el turno cerró.
 * - `agent_key`: en filas `assistant`, la `key` del agente que produjo el
 *   mensaje (para mostrar su avatar/nombre al recargar el hilo). Null en filas
 *   viejas o de un solo agente.
 * - `attachments`: en filas `user`, los archivos adjuntos del mensaje (imágenes
 *   para visión y documentos con su texto extraído). JSON: `ChatAttachment[]`.
 */
export const ChatMessage = model.define('chat_message', {
  id: model.id().primaryKey(),
  thread_id: model.text().index('IDX_chat_message_thread_id'),
  role: model.enum(['system', 'user', 'assistant', 'tool']),
  content: model.text().nullable(),
  tool_calls: model.json().nullable(),
  tool_call_id: model.text().nullable(),
  status: model.enum(['complete', 'pending']).nullable(),
  agent_key: model.text().nullable(),
  attachments: model.json().nullable(),
});
