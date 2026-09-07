import { model } from '@medusajs/framework/utils';

/**
 * Servidor MCP externo (de terceros) que el Asistente IA puede consumir además
 * del MCP interno (`mcp-medusa`). Se registra desde el backoffice; sus tools se
 * descubren on-demand (botón "Probar/Refrescar") y se cachean en `tools_cache`
 * para no abrir conexión en el hot path del loop. La ejecución de una tool abre
 * una conexión efímera (connect → callTool → close).
 *
 * Las tools externas se exponen al modelo con nombre namespaced
 * `mcp__<key>__<tool>` (el interno conserva sus nombres). El gating de permisos
 * lo sigue resolviendo `ToolPolicy` global (por default caen en `ask`).
 *
 * Credenciales: nunca se guardan en claro. `auth_secret_enc` y los `oauth_*_enc`
 * van cifrados con AES-256-GCM (ver `crypto.ts`); las APIs admin nunca los
 * devuelven. `secret_source` no se modela: si hay `auth_secret_enc` está cifrado
 * en DB (la opción elegida fue cifrado en reposo).
 */
export const McpServer = model.define('ai_mcp_server', {
  id: model.id().primaryKey(),
  key: model.text(),
  name: model.text(),
  url: model.text(),
  // Avatar/ícono opcional (foto subida al bucket); sin ella, iniciales sobre color por key.
  avatar_url: model.text().nullable(),
  transport: model.enum(['http', 'sse']).default('http'),
  auth_type: model.enum(['none', 'bearer', 'header', 'oauth']).default('bearer'),
  // Para auth_type='header': nombre del header (p. ej. 'X-API-Key').
  auth_header_name: model.text().nullable(),
  // Token/clave cifrado (bearer/header).
  auth_secret_enc: model.text().nullable(),
  // OAuth (auth_type='oauth'): cliente + tokens, todo cifrado.
  oauth_client_id: model.text().nullable(),
  oauth_client_secret_enc: model.text().nullable(),
  oauth_scope: model.text().nullable(),
  // Metadata descubierta del Authorization Server / Protected Resource (endpoints).
  oauth_meta: model.json().nullable(),
  oauth_access_enc: model.text().nullable(),
  oauth_refresh_enc: model.text().nullable(),
  oauth_expires_at: model.dateTime().nullable(),
  // Estado transitorio del flujo de autorización: { state, code_verifier }.
  oauth_pending: model.json().nullable(),
  // Estado operativo.
  enabled: model.boolean().default(true),
  // Catálogo de tools descubierto: [{ name, namespaced_name, description?, parameters?, read_only_hint? }].
  tools_cache: model.json().nullable(),
  tools_count: model.number().default(0),
  health: model.enum(['unknown', 'ok', 'error']).default('unknown'),
  last_error: model.text().nullable(),
  last_connected_at: model.dateTime().nullable(),
  last_discovered_at: model.dateTime().nullable(),
  created_by: model.text().nullable(),
});
