import { SKILL_PROMPTS, type ConcreteSkillId } from './prompt';

/**
 * Acotamiento de la superficie de tools de un agente. `tool` es el nombre del
 * tool del MCP; `resources`/`actions` (opcionales) lo restringen más todavía.
 * Ausencia de allow-list (null) = el agente ve TODAS las tools (menos las
 * prohibidas globalmente por `ToolPolicy`).
 */
export type ToolScope = {
  tool: string;
  resources?: string[];
  actions?: string[];
};

/**
 * Agente resuelto y listo para correr: lo que el loop necesita sin atarse a la
 * fila de DB. Lo produce `resolveActiveAgent` a partir de `ai_agent`/`ai_skill`,
 * o del `GENERAL_AGENT` hardcodeado cuando todavía no hay agentes sembrados.
 */
export type ResolvedAgent = {
  key: string;
  name: string;
  /** Rol/descripción corta (se usa como "rol" en el bloque de estilo de equipo). */
  description?: string;
  /** Texto propio del agente; se compone con CORE_PROMPT + skills + SKILL_COMMON. */
  instructions: string;
  /** Instrucciones de los skills adjuntos, ya resueltas a texto. */
  skillTexts: string[];
  model?: string;
  maxTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  /** null = ve todas las tools (menos las prohibidas globalmente). */
  allowedTools: ToolScope[] | null;
  handoffTargets: string[];
  isOrchestrator: boolean;
  /**
   * Tipos de memoria que recupera este agente (ver `ai_agent_memory`). null =
   * default (`DEFAULT_MEMORY_TYPES`). El retrieval siempre suma `document_chunk`
   * para que entre el contexto que el agente tiene cargado.
   */
  memoryTypes: string[] | null;
};

/**
 * Agente por defecto hardcodeado. Reproduce EXACTAMENTE el comportamiento del
 * asistente de un solo agente: sin instrucciones propias ni skills (el system
 * prompt resultante = CORE_PROMPT + SKILL_COMMON, igual que el `buildSystemPrompt()`
 * histórico) y sin acotar tools. Es el fallback cuando no hay filas en `ai_agent`
 * (p. ej. antes de correr la migración/seed en un deploy nuevo), así el chat nunca
 * se rompe por falta de datos.
 */
export const GENERAL_AGENT: ResolvedAgent = {
  key: 'general',
  name: 'Asistente',
  instructions: '',
  skillTexts: [],
  allowedTools: null,
  handoffTargets: [],
  isOrchestrator: true,
  memoryTypes: null,
};

/**
 * Forma mínima del store que necesita el resolver (la cumple el service del
 * módulo). Se tipa estructuralmente para no crear un import circular con `agent.ts`.
 */
type AgentStore = {
  retrieveChatThread(id: string): Promise<any>;
  listAgents(filters?: any, config?: any): Promise<any[]>;
  retrieveAgent(id: string): Promise<any>;
  listSkills(filters?: any, config?: any): Promise<any[]>;
};

/** Resuelve las instrucciones de los skills adjuntos (DB, con fallback al hardcode). */
async function resolveSkillTexts(store: AgentStore, keys: string[]): Promise<string[]> {
  if (!keys || keys.length === 0) return [];
  let rows: any[] = [];
  try {
    rows = await store.listSkills({ key: keys, enabled: true }, { take: 100 });
  } catch {
    rows = [];
  }
  const byKey = new Map<string, string>(rows.map((r) => [r.key, r.instructions]));
  return keys
    .map((k) => byKey.get(k) ?? SKILL_PROMPTS[k as ConcreteSkillId])
    .filter((t): t is string => Boolean(t));
}

function rowToResolved(row: any, skillTexts: string[]): ResolvedAgent {
  return {
    key: row.key,
    name: row.name,
    description: row.description ?? undefined,
    instructions: row.instructions ?? '',
    skillTexts,
    model: row.model ?? undefined,
    maxTokens: row.max_tokens ?? undefined,
    reasoningEffort: row.reasoning_effort ?? undefined,
    allowedTools: Array.isArray(row.allowed_tools) ? row.allowed_tools : null,
    handoffTargets: Array.isArray(row.handoff_targets) ? row.handoff_targets.map(String) : [],
    isOrchestrator: Boolean(row.is_orchestrator),
    memoryTypes: Array.isArray(row.memory_types) ? row.memory_types.map(String) : null,
  };
}

/**
 * Resuelve el agente que atiende el hilo: el `active_agent_id` si está seteado y
 * habilitado; si no, el orquestador (o el de menor `rank`); si no hay ninguno (o
 * la tabla `ai_agent` todavía no existe), el `GENERAL_AGENT`. Nunca tira: ante
 * cualquier error cae al default para no romper el chat.
 */
export async function resolveActiveAgent(
  store: AgentStore,
  threadOrId: string | { id: string; active_agent_id?: string | null },
): Promise<ResolvedAgent> {
  try {
    const thread =
      typeof threadOrId === 'string'
        ? await store.retrieveChatThread(threadOrId).catch(() => null)
        : threadOrId;

    let row: any = null;
    const activeId = thread?.active_agent_id;
    if (activeId) {
      row = await store.retrieveAgent(activeId).catch(() => null);
      if (row && row.enabled === false) row = null;
    }
    if (!row) {
      const agents = await store.listAgents(
        { enabled: true },
        { order: { rank: 'ASC' }, take: 200 },
      );
      row = agents.find((a) => a.is_orchestrator) ?? agents[0] ?? null;
    }
    if (!row) return GENERAL_AGENT;

    const skillKeys = Array.isArray(row.skills) ? row.skills.map(String) : [];
    const skillTexts = await resolveSkillTexts(store, skillKeys);
    return rowToResolved(row, skillTexts);
  } catch {
    return GENERAL_AGENT;
  }
}

/**
 * Resuelve un agente por su `key` (lo usan los flujos headless, p. ej. el job de
 * Propuestas). Cae al `GENERAL_AGENT` si no existe o está deshabilitado.
 */
export async function resolveAgentByKey(
  store: AgentStore,
  key: string,
): Promise<ResolvedAgent> {
  try {
    const rows = await store.listAgents({ key, enabled: true }, { take: 1 });
    const row = rows[0];
    if (!row) return GENERAL_AGENT;
    const skillKeys = Array.isArray(row.skills) ? row.skills.map(String) : [];
    const skillTexts = await resolveSkillTexts(store, skillKeys);
    return rowToResolved(row, skillTexts);
  } catch {
    return GENERAL_AGENT;
  }
}
