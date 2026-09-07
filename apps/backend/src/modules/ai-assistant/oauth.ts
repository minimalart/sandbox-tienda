import { createHash, randomBytes } from 'crypto';
import { hashToken } from './mcp-keys';

/**
 * Helpers del Authorization Server OAuth 2.1 del MCP. Tokens/codes OPACOS:
 * random de alta entropía, se guarda solo el hash SHA-256 (reusa `hashToken`).
 */

export { hashToken };

/** URL pública del backend (sin barra final). Es a la vez issuer y resource. */
export function baseUrl(): string {
  const raw =
    process.env.BACKEND_URL || process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  return raw.replace(/\/+$/, '');
}

export type Opaque = { token: string; hash: string; prefix: string };

export function generateOpaque(prefix: string): Opaque {
  const token = `${prefix}${randomBytes(32).toString('base64url')}`;
  return { token, hash: hashToken(token), prefix: `${token.slice(0, 12)}…` };
}

/** Verifica PKCE S256: base64url(sha256(verifier)) === challenge. */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  const computed = createHash('sha256').update(verifier).digest('base64url');
  return computed === challenge;
}

/** Metadata de protected resource (RFC 9728) — la lee el cliente para descubrir el AS. */
export function protectedResourceMetadata() {
  const base = baseUrl();
  return {
    resource: `${base}/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ['header'],
    scopes_supported: ['mcp'],
  };
}

/** Metadata del Authorization Server (RFC 8414) — apunta a NUESTROS endpoints. */
export function authorizationServerMetadata() {
  const base = baseUrl();
  return {
    issuer: base,
    authorization_endpoint: `${base}/mcp/oauth/authorize`,
    token_endpoint: `${base}/mcp/oauth/token`,
    registration_endpoint: `${base}/mcp/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['mcp'],
  };
}

export const ACCESS_TOKEN_TTL_SEC = 60 * 60; // 1 h
export const CODE_TTL_SEC = 5 * 60; // 5 min
