import { model } from '@medusajs/framework/utils';

/**
 * Authorization code OAuth (corto, single-use). Solo se guarda el hash del code.
 * `code_challenge` es el PKCE (S256) que se verifica en /token. `admin_id` es el
 * usuario admin de Medusa que aprobó el login.
 */
export const OAuthCode = model.define('oauth_code', {
  id: model.id().primaryKey(),
  code_hash: model.text().unique(),
  client_id: model.text(),
  redirect_uri: model.text(),
  scope: model.text().nullable(),
  code_challenge: model.text(),
  admin_id: model.text(),
  expires_at: model.dateTime(),
  used: model.boolean().default(false),
});
