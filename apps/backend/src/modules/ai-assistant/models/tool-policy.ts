import { model } from '@medusajs/framework/utils';

/**
 * Override de permiso para una (tool, acción, resource) del MCP. Solo se
 * persisten los overrides; lo que no tiene fila usa el default computado en
 * código (read→auto, write→ask, v2.request→prohibited). Ver `ai/policy.ts`.
 *
 * `resource` es '' para las tools que no exponen un parámetro `resource` enum;
 * para las que sí (p. ej. `manage_minimalart_extensions`) permite granularidad
 * por entidad (brands, banners, blog_posts, …).
 *
 * - `auto`: el asistente ejecuta la acción sin preguntar.
 * - `ask`: requiere confirmación del usuario antes de ejecutar (modo "consulta").
 * - `prohibited`: la tool/acción ni siquiera se ofrece al modelo.
 */
export const ToolPolicy = model.define('ai_tool_policy', {
  id: model.id().primaryKey(),
  tool_name: model.text(),
  action: model.text(),
  resource: model.text().default(''),
  mode: model.enum(['auto', 'ask', 'prohibited']),
});
