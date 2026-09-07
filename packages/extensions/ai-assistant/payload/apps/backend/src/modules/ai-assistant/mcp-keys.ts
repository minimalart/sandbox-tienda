import { createHash, randomBytes } from 'crypto';

/**
 * Utilidades de API keys del MCP. Los tokens son aleatorios de alta entropía, así
 * que se hashean con SHA-256 (no hace falta bcrypt: no son contraseñas de baja
 * entropía y el hash se compara en cada request). Solo se guarda el hash.
 */

const TOKEN_PREFIX = 'mcp_';

export type GeneratedToken = {
  /** Token en claro — se muestra UNA sola vez al usuario. */
  token: string;
  /** SHA-256 del token (lo que se persiste). */
  hash: string;
  /** Prefijo visible para identificar la key en la UI. */
  prefix: string;
};

export function hashToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

export function generateToken(): GeneratedToken {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  return {
    token,
    hash: hashToken(token),
    prefix: `${token.slice(0, 12)}…`,
  };
}

/** Extrae el Bearer token del header Authorization, si existe. */
export function bearerFromHeader(authorization?: string): string | null {
  if (!authorization) return null;
  const m = authorization.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ? m[1].trim() : null;
}
