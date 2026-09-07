import { model } from '@medusajs/framework/utils';

/**
 * Cliente OAuth registrado dinámicamente (RFC 7591) por un conector MCP
 * (claude.ai, ChatGPT, etc.). Cliente PÚBLICO: usa PKCE, sin client_secret.
 */
export const OAuthClient = model.define('oauth_client', {
  id: model.id().primaryKey(),
  client_name: model.text().nullable(),
  redirect_uris: model.json(),
});
