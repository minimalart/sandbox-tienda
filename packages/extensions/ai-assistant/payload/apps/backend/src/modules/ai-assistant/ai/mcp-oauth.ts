import { createHash, randomBytes } from 'crypto';
import { encryptSecret, tryDecryptSecret } from '../crypto';

/**
 * OAuth 2.1 (Authorization Code + PKCE) como CLIENTE contra un servidor MCP
 * externo. Implementado con `fetch` plano (discovery RFC 9728/8414 + DCR RFC 7591
 * + token), sin atarse a firmas internas del SDK. Lo usan las rutas
 * `mcp-servers/:id/oauth/start` y la ruta pública `mcp-oauth/callback`.
 *
 * El refresh de tokens vive en `mcp-auth.ts` (lo necesita la ejecución de tools).
 */

type OAuthStore = {
  retrieveMcpServer(id: string): Promise<any>;
  updateMcpServers(data: any): Promise<any>;
};

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function fetchJson(url: string, init?: RequestInit): Promise<any | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

type AsMeta = {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
};

/**
 * Descubre el Authorization Server de un MCP: primero la Protected Resource
 * Metadata (RFC 9728) para hallar el AS; si no, asume que el propio servidor es el
 * AS. Después la AS Metadata (RFC 8414 / OpenID Connect discovery).
 */
async function discoverAuthServer(
  serverUrl: string,
): Promise<{ as: AsMeta; resource?: string } | null> {
  const origin = new URL(serverUrl).origin;
  const prm = await fetchJson(new URL('/.well-known/oauth-protected-resource', origin).href);
  let asUrl = origin;
  const resource: string | undefined = prm?.resource;
  if (Array.isArray(prm?.authorization_servers) && prm.authorization_servers[0]) {
    asUrl = String(prm.authorization_servers[0]);
  }
  const asOrigin = new URL(asUrl).origin;
  const asMeta =
    (await fetchJson(new URL('/.well-known/oauth-authorization-server', asOrigin).href)) ||
    (await fetchJson(new URL('/.well-known/openid-configuration', asOrigin).href));
  if (!asMeta?.authorization_endpoint || !asMeta?.token_endpoint) return null;
  return {
    as: {
      authorization_endpoint: String(asMeta.authorization_endpoint),
      token_endpoint: String(asMeta.token_endpoint),
      registration_endpoint: asMeta.registration_endpoint
        ? String(asMeta.registration_endpoint)
        : undefined,
    },
    resource,
  };
}

/** Registro dinámico de cliente (RFC 7591) como cliente público (PKCE, sin secret). */
async function dynamicRegister(
  registrationEndpoint: string,
  redirectUri: string,
): Promise<{ client_id: string; client_secret?: string } | null> {
  const json = await fetchJson(registrationEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Medusa AI Assistant',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  if (!json?.client_id) return null;
  return { client_id: String(json.client_id), client_secret: json.client_secret };
}

/**
 * Arranca el flujo: descubre el AS, registra el cliente (DCR si hace falta), genera
 * PKCE + state, persiste el estado pendiente y devuelve la authorization URL.
 */
export async function buildAuthorizationUrl(
  store: OAuthStore,
  serverId: string,
  redirectUri: string,
): Promise<{ url?: string; error?: string }> {
  const server = await store.retrieveMcpServer(serverId).catch(() => null);
  if (!server) return { error: 'Servidor MCP no encontrado.' };

  const disc = await discoverAuthServer(server.url);
  if (!disc) {
    return { error: 'No se pudo descubrir el OAuth del servidor (sin metadata de Authorization Server).' };
  }
  const { as, resource } = disc;

  let clientId: string | undefined = server.oauth_client_id ?? undefined;
  let clientSecretPlain = tryDecryptSecret(server.oauth_client_secret_enc) ?? undefined;
  if (!clientId) {
    if (!as.registration_endpoint) {
      return { error: 'El servidor no soporta registro dinámico (DCR); cargá un client_id manualmente.' };
    }
    const reg = await dynamicRegister(as.registration_endpoint, redirectUri);
    if (!reg) return { error: 'Falló el registro dinámico (DCR) del cliente OAuth.' };
    clientId = reg.client_id;
    clientSecretPlain = reg.client_secret;
  }

  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = `${serverId}.${b64url(randomBytes(16))}`;

  const authUrl = new URL(as.authorization_endpoint);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  if (server.oauth_scope) authUrl.searchParams.set('scope', String(server.oauth_scope));
  // RFC 8707: ata el token al recurso MCP (si el AS lo soporta).
  if (resource) authUrl.searchParams.set('resource', resource);

  const patch: Record<string, any> = {
    id: serverId,
    oauth_client_id: clientId,
    oauth_meta: {
      token_endpoint: as.token_endpoint,
      authorization_endpoint: as.authorization_endpoint,
      registration_endpoint: as.registration_endpoint ?? null,
      resource: resource ?? null,
    },
    oauth_pending: { state, verifier_enc: encryptSecret(verifier), redirect_uri: redirectUri },
  };
  if (clientSecretPlain) patch.oauth_client_secret_enc = encryptSecret(clientSecretPlain);
  await store.updateMcpServers(patch);

  return { url: authUrl.toString() };
}

/**
 * Cierra el flujo: valida el `state`, intercambia el `code` por tokens (PKCE) y los
 * persiste cifrados. Devuelve si salió bien y el nombre del servidor (para la UI).
 */
export async function completeOAuth(
  store: OAuthStore,
  state: string,
  code: string,
): Promise<{ ok: boolean; error?: string; serverName?: string }> {
  const serverId = state.split('.')[0];
  if (!serverId) return { ok: false, error: 'state inválido.' };

  const server = await store.retrieveMcpServer(serverId).catch(() => null);
  if (!server) return { ok: false, error: 'Servidor MCP no encontrado.' };

  const pending = server.oauth_pending;
  if (!pending || pending.state !== state) {
    return { ok: false, error: 'El state no coincide o expiró; reiniciá la conexión.' };
  }
  const verifier = tryDecryptSecret(pending.verifier_enc);
  const tokenEndpoint = server.oauth_meta?.token_endpoint;
  const redirectUri = pending.redirect_uri;
  if (!verifier || !tokenEndpoint || !redirectUri) {
    return { ok: false, error: 'Falta información del flujo OAuth; reiniciá la conexión.' };
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  if (server.oauth_client_id) body.set('client_id', String(server.oauth_client_id));
  const clientSecret = tryDecryptSecret(server.oauth_client_secret_enc);
  if (clientSecret) body.set('client_secret', clientSecret);

  try {
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
    const patch: Record<string, any> = {
      id: serverId,
      oauth_pending: null,
      health: 'ok',
      last_error: null,
      last_connected_at: new Date(),
    };
    if (json.access_token) patch.oauth_access_enc = encryptSecret(json.access_token);
    if (json.refresh_token) patch.oauth_refresh_enc = encryptSecret(json.refresh_token);
    if (json.expires_in) patch.oauth_expires_at = new Date(Date.now() + Number(json.expires_in) * 1000);
    await store.updateMcpServers(patch);
    return { ok: true, serverName: server.name };
  } catch (e) {
    await store
      .updateMcpServers({
        id: serverId,
        health: 'error',
        last_error: `Falló el intercambio OAuth: ${(e as Error).message}`,
      })
      .catch(() => {});
    return { ok: false, error: (e as Error).message };
  }
}
