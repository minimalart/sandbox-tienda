import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../modules/ai-assistant';

type AiService = any;

function isValidRedirect(uri: unknown): uri is string {
  if (typeof uri !== 'string') return false;
  try {
    const u = new URL(uri);
    if (u.protocol === 'https:') return true;
    // http solo para loopback (desarrollo).
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

/**
 * POST /mcp/oauth/register — Dynamic Client Registration (RFC 7591).
 * Cliente público (PKCE, sin secret). Endpoint sin auth (lo llama el conector).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const body = (req.body ?? {}) as any;

  const redirectUris: unknown = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || !redirectUris.every(isValidRedirect)) {
    res.status(400).json({
      error: 'invalid_redirect_uri',
      error_description: 'redirect_uris debe ser un array de URLs https (o http loopback).',
    });
    return;
  }

  const client = await service.createOAuthClients({
    client_name: typeof body.client_name === 'string' ? body.client_name : null,
    redirect_uris: redirectUris,
  });

  res.status(201).json({
    client_id: client.id,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: client.client_name ?? undefined,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  });
};
