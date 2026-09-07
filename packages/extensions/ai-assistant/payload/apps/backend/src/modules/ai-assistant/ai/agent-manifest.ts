import type { ToolScope } from './agents';

/**
 * Normalización del manifiesto de un agente que llega desde la UI (o un import de
 * terceros). Es PURA y testeable: no toca DB. Limpia/deduplica las listas, arma el
 * slug de `key` y evita el auto-handoff. El gating de permisos lo sigue resolviendo
 * `ToolPolicy` global; acá solo se normaliza el allow-list declarado.
 */
export type AgentManifestInput = {
  key?: string;
  name?: string;
  description?: string | null;
  instructions?: string;
  model?: string | null;
  max_tokens?: number | null;
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high' | null;
  enabled?: boolean;
  is_orchestrator?: boolean;
  rank?: number;
  icon?: string | null;
  avatar_url?: string | null;
  allowed_tools?: ToolScope[] | null;
  skills?: string[];
  handoff_targets?: string[];
  memory_types?: string[] | null;
};

export type NormalizedManifest = {
  key: string;
  name: string;
  description: string | null;
  instructions: string;
  model: string | null;
  max_tokens: number | null;
  reasoning_effort: 'minimal' | 'low' | 'medium' | 'high' | null;
  enabled: boolean;
  is_orchestrator: boolean;
  rank: number;
  icon: string | null;
  avatar_url: string | null;
  allowed_tools: ToolScope[] | null;
  skills: string[];
  handoff_targets: string[];
  memory_types: string[] | null;
};

/** Slug estable para `key`: minúsculas, solo [a-z0-9_-], sin bordes ni dobles. */
export function slugifyKey(raw: string): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 60);
}

function cleanStringList(list: unknown, exclude?: string): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of list) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (!s || s === exclude || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function cleanAllowedTools(list: unknown): ToolScope[] | null {
  // null = sin allow-list (el agente ve todas las tools no prohibidas).
  if (list == null || !Array.isArray(list)) return null;
  const seen = new Set<string>();
  const out: ToolScope[] = [];
  for (const v of list) {
    const raw = v as { tool?: unknown; resources?: unknown; actions?: unknown } | null;
    const tool = raw && typeof raw.tool === 'string' ? raw.tool.trim() : '';
    if (!tool || seen.has(tool)) continue;
    seen.add(tool);
    const scope: ToolScope = { tool };
    const resources = cleanStringList(raw?.resources);
    const actions = cleanStringList(raw?.actions);
    if (resources.length) scope.resources = resources;
    if (actions.length) scope.actions = actions;
    out.push(scope);
  }
  return out;
}

export function normalizeManifest(input: AgentManifestInput): NormalizedManifest {
  const key = slugifyKey(input.key || input.name || '');
  return {
    key,
    name: (input.name ?? '').trim() || key,
    description: input.description?.trim() || null,
    instructions: (input.instructions ?? '').trim(),
    model: input.model?.trim() || null,
    max_tokens:
      typeof input.max_tokens === 'number' && input.max_tokens > 0
        ? Math.floor(input.max_tokens)
        : null,
    reasoning_effort: input.reasoning_effort ?? null,
    enabled: input.enabled !== false,
    is_orchestrator: Boolean(input.is_orchestrator),
    rank: typeof input.rank === 'number' ? input.rank : 0,
    icon: input.icon?.trim() || null,
    avatar_url: input.avatar_url?.trim() || null,
    allowed_tools: cleanAllowedTools(input.allowed_tools),
    skills: cleanStringList(input.skills),
    // handoff nunca se apunta a sí mismo
    handoff_targets: cleanStringList(input.handoff_targets, key),
    // null = default (todos menos document_chunk); lista no vacía = esos tipos.
    memory_types:
      Array.isArray(input.memory_types) && cleanStringList(input.memory_types).length
        ? cleanStringList(input.memory_types)
        : null,
  };
}
