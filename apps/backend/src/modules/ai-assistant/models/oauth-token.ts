import { model } from '@medusajs/framework/utils';

/**
 * Access/refresh token OAuth emitido por nuestro AS. Tokens OPACOS: solo se
 * guardan los hashes (SHA-256). El middleware de /mcp valida por lookup del
 * `token_hash` (no vencido, no revocado), igual que las API keys.
 */
export const OAuthToken = model.define('oauth_token', {
  id: model.id().primaryKey(),
  token_hash: model.text().unique(),
  token_prefix: model.text(),
  refresh_hash: model.text().nullable(),
  client_id: model.text(),
  scope: model.text().nullable(),
  admin_id: model.text(),
  expires_at: model.dateTime(),
  revoked: model.boolean().default(false),
});
