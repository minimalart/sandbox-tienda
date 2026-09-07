import { model } from '@medusajs/framework/utils';

/**
 * API key gestionada para acceder al endpoint `/mcp` (Claude Desktop, Cursor,
 * producción, etc.). Solo se guarda el HASH del token (como una contraseña): el
 * valor en claro se muestra UNA sola vez al crearla.
 *
 * - `token_prefix`: primeros caracteres del token, para identificarla en la UI.
 * - `last_used_at` / `request_count`: métricas de uso por key.
 * - `revoked`: revocación individual (la key deja de autenticar).
 */
export const McpApiKey = model.define('mcp_api_key', {
  id: model.id().primaryKey(),
  name: model.text(),
  token_hash: model.text().unique(),
  token_prefix: model.text(),
  last_used_at: model.dateTime().nullable(),
  request_count: model.number().default(0),
  revoked: model.boolean().default(false),
  created_by: model.text().nullable(),
});
