import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../modules/ai-assistant';
import {
  generateOpaque,
  hashToken,
  verifyPkceS256,
  ACCESS_TOKEN_TTL_SEC,
} from '../../../../modules/ai-assistant/oauth';

type AiService = any;

function fail(res: MedusaResponse, error: string, description?: string, status = 400) {
  res.status(status).json({ error, ...(description ? { error_description: description } : {}) });
}

async function issueTokens(
  service: AiService,
  opts: { client_id: string; scope: string | null; admin_id: string },
) {
  const access = generateOpaque('oat_');
  const refresh = generateOpaque('oar_');
  await service.createOAuthTokens({
    token_hash: access.hash,
    token_prefix: access.prefix,
    refresh_hash: refresh.hash,
    client_id: opts.client_id,
    scope: opts.scope,
    admin_id: opts.admin_id,
    expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_SEC * 1000),
    revoked: false,
  });
  return {
    access_token: access.token,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SEC,
    refresh_token: refresh.token,
    scope: opts.scope ?? 'mcp',
  };
}

/** POST /mcp/oauth/token — authorization_code (PKCE) y refresh_token. */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const body = (req.body ?? {}) as Record<string, any>;
  const grantType = body.grant_type;

  if (grantType === 'authorization_code') {
    const { code, redirect_uri, client_id, code_verifier } = body;
    if (!code || !redirect_uri || !client_id || !code_verifier) {
      return fail(res, 'invalid_request', 'Faltan parámetros del authorization_code.');
    }

    const [row] = await service.listOAuthCodes({ code_hash: hashToken(code) }, { take: 1 });
    if (!row || row.used) return fail(res, 'invalid_grant', 'Code inválido o ya usado.');
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return fail(res, 'invalid_grant', 'Code vencido.');
    }
    if (row.client_id !== client_id || row.redirect_uri !== redirect_uri) {
      return fail(res, 'invalid_grant', 'client_id o redirect_uri no coinciden.');
    }
    if (!verifyPkceS256(code_verifier, row.code_challenge)) {
      return fail(res, 'invalid_grant', 'PKCE inválido.');
    }

    await service.updateOAuthCodes({ id: row.id, used: true });
    const tokens = await issueTokens(service, {
      client_id: row.client_id,
      scope: row.scope ?? 'mcp',
      admin_id: row.admin_id,
    });
    res.json(tokens);
    return;
  }

  if (grantType === 'refresh_token') {
    const { refresh_token } = body;
    if (!refresh_token) return fail(res, 'invalid_request', 'Falta refresh_token.');

    const [row] = await service.listOAuthTokens(
      { refresh_hash: hashToken(refresh_token), revoked: false },
      { take: 1 },
    );
    if (!row) return fail(res, 'invalid_grant', 'Refresh token inválido.');

    // Rotación: revocamos el viejo y emitimos uno nuevo.
    await service.updateOAuthTokens({ id: row.id, revoked: true });
    const tokens = await issueTokens(service, {
      client_id: row.client_id,
      scope: row.scope ?? 'mcp',
      admin_id: row.admin_id,
    });
    res.json(tokens);
    return;
  }

  return fail(res, 'unsupported_grant_type', `grant_type no soportado: ${grantType}`);
};
