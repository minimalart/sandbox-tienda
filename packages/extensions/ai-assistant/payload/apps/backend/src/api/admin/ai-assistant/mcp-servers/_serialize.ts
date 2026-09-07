/**
 * Serialización pública de un servidor MCP externo para las APIs admin: NUNCA
 * expone secretos (`*_enc`) ni el estado transitorio del flujo OAuth. Solo indica
 * si hay credencial configurada (`has_secret`) y si OAuth está conectado.
 */
export function toPublicServer(s: any) {
  const tools = Array.isArray(s.tools_cache) ? s.tools_cache : [];
  return {
    id: s.id,
    key: s.key,
    name: s.name,
    url: s.url,
    avatar_url: s.avatar_url ?? null,
    transport: s.transport,
    auth_type: s.auth_type,
    auth_header_name: s.auth_header_name ?? null,
    enabled: s.enabled,
    has_secret: Boolean(s.auth_secret_enc),
    oauth_client_id: s.oauth_client_id ?? null,
    oauth_scope: s.oauth_scope ?? null,
    oauth_connected: Boolean(s.oauth_access_enc),
    tools_count: s.tools_count ?? tools.length,
    tools: tools.map((t: any) => ({
      name: t.name,
      namespaced_name: t.namespaced_name,
      description: t.description ?? null,
      read_only_hint: Boolean(t.read_only_hint),
    })),
    health: s.health,
    last_error: s.last_error ?? null,
    last_connected_at: s.last_connected_at ?? null,
    last_discovered_at: s.last_discovered_at ?? null,
    created_at: s.created_at,
  };
}
