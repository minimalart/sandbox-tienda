import { encryptSecret, tryDecryptSecret } from '../crypto';

/**
 * Resolución de headers de autenticación para conectar a un servidor MCP externo.
 * Soporta `none`, `bearer`, `header` (token estático cifrado) y `oauth` (token de
 * acceso cifrado, con refresh automático si venció). Para `oauth`, el flujo de
 * autorización inicial vive en `ai/mcp-oauth.ts` (rutas start/callback); acá solo
 * usamos/refrescamos los tokens ya obtenidos.
 *
 * Nunca lanza: si no hay credencial válida devuelve `{}` y el servidor responderá
 * 401 → el resultado de la tool lo explica (no rompe el chat).
 */

type AuthStore = {
  updateMcpServers(data: any): Promise<any>;
};

type ServerRow = Record<string, any>;

const EXPIRY_SKEW_MS = 60_000; // refrescar 1 min antes del vencimiento.

export async function resolveAuthHeaders(
  store: AuthStore,
  server: ServerRow,
): Promise<Record<string, string>> {
  switch (server.auth_type) {
    case 'none':
      return {};
    case 'bearer': {
      const token = tryDecryptSecret(server.auth_secret_enc);
      return token ? { Authorization: `Bearer ${token}` } : {};
    }
    case 'header': {
      const token = tryDecryptSecret(server.auth_secret_enc);
      const name = String(server.auth_header_name ?? '').trim();
      return token && name ? { [name]: token } : {};
    }
    case 'oauth': {
      const token = await ensureOAuthAccessToken(store, server);
      return token ? { Authorization: `Bearer ${token}` } : {};
    }
    default:
      return {};
  }
}

/**
 * Devuelve un access token OAuth vigente: el guardado si no venció, o uno nuevo
 * vía refresh_token. Persiste los tokens rotados (cifrados). Si el refresh falla,
 * marca el servidor en error y devuelve lo que haya (o null).
 */
export async function ensureOAuthAccessToken(
  store: AuthStore,
  server: ServerRow,
): Promise<string | null> {
  const access = tryDecryptSecret(server.oauth_access_enc);
  const expMs = server.oauth_expires_at ? new Date(server.oauth_expires_at).getTime() : 0;
  const stillValid = access && (!expMs || expMs - Date.now() > EXPIRY_SKEW_MS);
  if (stillValid) return access;

  const refresh = tryDecryptSecret(server.oauth_refresh_enc);
  const tokenEndpoint = (server.oauth_meta as { token_endpoint?: string } | null)?.token_endpoint;
  if (!refresh || !tokenEndpoint) return access ?? null;

  try {
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh });
    if (server.oauth_client_id) body.set('client_id', String(server.oauth_client_id));
    const clientSecret = tryDecryptSecret(server.oauth_client_secret_enc);
    if (clientSecret) body.set('client_secret', clientSecret);

    const res = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    });
    if (!res.ok) throw new Error(`token endpoint respondió ${res.status}`);
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const patch: ServerRow = { id: server.id, health: 'ok', last_error: null };
    if (json.access_token) patch.oauth_access_enc = encryptSecret(json.access_token);
    // Algunos AS rotan el refresh token; si no, conservamos el actual.
    if (json.refresh_token) patch.oauth_refresh_enc = encryptSecret(json.refresh_token);
    if (json.expires_in) {
      patch.oauth_expires_at = new Date(Date.now() + Number(json.expires_in) * 1000);
    }
    await store.updateMcpServers(patch);
    return json.access_token ?? access ?? null;
  } catch (e) {
    await store
      .updateMcpServers({
        id: server.id,
        health: 'error',
        last_error: `No se pudo refrescar el token OAuth (${
          (e as Error).message
        }); reconectá el servidor.`,
      })
      .catch(() => {});
    return access ?? null;
  }
}
