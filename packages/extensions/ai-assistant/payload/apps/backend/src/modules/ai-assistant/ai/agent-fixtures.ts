/**
 * Dobles de prueba del loop agéntico.
 *
 * Vive en un `.ts` normal y NO en un `.test.ts` a propósito: el `tsconfig.json`
 * del backend excluye los `*.test.ts`, así que un fixture escrito adentro de un
 * test no lo typechequea nadie. Acá `tsc` obliga a que `fakeStore` implemente los
 * 33 métodos de `AiStore`, que es justamente la garantía que queremos: si el
 * contrato de persistencia cambia, el doble deja de compilar.
 */
import type { ChatCompletionMessage, ChatRequest, ChatUsage, ModelProvider } from './chat-client';
import type { ToolRuntime } from './tool-registry';
import type { AiStore, ToolCall } from './types';

/** Fila de `chat_message` tal como la persiste el loop. */
export type FakeRow = {
  id: string;
  thread_id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls: ToolCall[] | null;
  tool_call_id: string | null;
  status: 'complete' | 'pending' | null;
  agent_key?: string | null;
  attachments?: unknown[] | null;
  created_at: number;
};

export type FakeAgentRow = {
  id: string;
  key: string;
  name: string;
  instructions: string;
  enabled?: boolean;
  is_orchestrator?: boolean;
  rank?: number;
  allowed_tools?: unknown[] | null;
  handoff_targets?: string[] | null;
  skills?: string[] | null;
  memory_types?: string[] | null;
  model?: string | null;
  max_tokens?: number | null;
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high' | null;
};

export type FakeStoreSeed = {
  threadId: string;
  /** Mensajes ya persistidos al arrancar el turno (normalmente el `user`). */
  messages: Array<Partial<FakeRow> & { role: FakeRow['role'] }>;
  agents: FakeAgentRow[];
  /** `active_agent_id` del hilo (es lo que muta el handoff). */
  activeAgentId?: string | null;
  policies: Array<{ tool_name: string; action: string; resource?: string; mode: string }>;
};

export type FakeStore = AiStore & {
  rows: {
    chatMessages: FakeRow[];
    agentRuns: Array<Record<string, unknown>>;
    agentSteps: Array<Record<string, unknown>>;
    threads: Array<Record<string, unknown>>;
  };
  /** Atajo de lectura: `[role, status]` por mensaje, en orden de escritura. */
  transcript(): Array<[string, string | null]>;
};

const DEFAULT_AGENT: FakeAgentRow = {
  id: 'ag_general',
  key: 'general',
  name: 'General',
  instructions: 'Sos el asistente general.',
  enabled: true,
  is_orchestrator: true,
  rank: 0,
};

/**
 * `AiStore` en memoria sobre arrays. Los métodos que el loop no ejercita
 * devuelven vacío en vez de tirar: el objetivo es correr el loop, no emular a
 * Medusa.
 */
export function fakeStore(seed: Partial<FakeStoreSeed> = {}): FakeStore {
  const threadId = seed.threadId ?? 'thr_1';
  const agents = seed.agents ?? [DEFAULT_AGENT];
  let seq = 0;
  const nextId = (p: string) => `${p}_${++seq}`;

  const chatMessages: FakeRow[] = (seed.messages ?? []).map((m, i) => ({
    id: m.id ?? `msg_seed_${i}`,
    thread_id: m.thread_id ?? threadId,
    role: m.role,
    content: m.content ?? null,
    tool_calls: m.tool_calls ?? null,
    tool_call_id: m.tool_call_id ?? null,
    status: m.status ?? 'complete',
    agent_key: m.agent_key ?? null,
    attachments: m.attachments ?? null,
    created_at: i,
  }));

  const threads: Array<Record<string, unknown>> = [
    { id: threadId, active_agent_id: seed.activeAgentId ?? null },
  ];
  const agentRuns: Array<Record<string, unknown>> = [];
  const agentSteps: Array<Record<string, unknown>> = [];
  const policies = seed.policies ?? [];

  const push = (data: Record<string, unknown>): FakeRow => {
    const row: FakeRow = {
      id: nextId('msg'),
      thread_id: String(data.thread_id ?? threadId),
      role: data.role as FakeRow['role'],
      content: (data.content as string) ?? null,
      tool_calls: (data.tool_calls as ToolCall[]) ?? null,
      tool_call_id: (data.tool_call_id as string) ?? null,
      status: (data.status as FakeRow['status']) ?? null,
      agent_key: (data.agent_key as string) ?? null,
      attachments: (data.attachments as unknown[]) ?? null,
      created_at: chatMessages.length + 1000,
    };
    chatMessages.push(row);
    return row;
  };

  return {
    rows: { chatMessages, agentRuns, agentSteps, threads },
    transcript: () => chatMessages.map((r) => [r.role, r.status] as [string, string | null]),

    // ── chat ──
    async listChatMessages(filters: any) {
      const tid = filters?.thread_id ?? threadId;
      return chatMessages.filter((r) => r.thread_id === tid);
    },
    async createChatMessages(data: any) {
      return Array.isArray(data) ? data.map(push) : push(data);
    },
    async updateChatMessages(data: any) {
      for (const patch of Array.isArray(data) ? data : [data]) {
        const row = chatMessages.find((r) => r.id === patch.id);
        if (row) Object.assign(row, patch);
      }
      return data;
    },
    async listToolPolicies() {
      return policies;
    },

    // ── registry de agentes ──
    async retrieveChatThread(id: string) {
      return threads.find((t) => t.id === id) ?? null;
    },
    async updateChatThreads(data: any) {
      for (const patch of Array.isArray(data) ? data : [data]) {
        const t = threads.find((x) => x.id === patch.id);
        if (t) Object.assign(t, patch);
      }
      return data;
    },
    async listAgents(filters: any = {}) {
      let out = agents.filter((a) => a.enabled !== false);
      if (filters?.key) out = out.filter((a) => a.key === filters.key);
      return [...out].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    },
    async retrieveAgent(id: string) {
      return agents.find((a) => a.id === id) ?? null;
    },
    async listSkills() {
      return [];
    },

    // ── trazabilidad ──
    async createAgentRuns(data: any) {
      const row = { id: nextId('run'), ...data };
      agentRuns.push(row);
      return row;
    },
    async updateAgentRuns(data: any) {
      for (const patch of Array.isArray(data) ? data : [data]) {
        const r = agentRuns.find((x) => x.id === patch.id);
        if (r) Object.assign(r, patch);
      }
      return data;
    },
    async createAgentSteps(data: any) {
      const row = { id: nextId('step'), ...data };
      agentSteps.push(row);
      return row;
    },

    // ── MCP externos: ninguno, así el descubrimiento queda determinista ──
    async listMcpServers() {
      return [];
    },
    async retrieveMcpServer() {
      return null;
    },
    async updateMcpServers(data: any) {
      return data;
    },

    // ── memoria: apagada en estos tests ──
    async createAgentMemories(data: any) {
      return data;
    },
    async updateAgentMemories(data: any) {
      return data;
    },
    async listAgentMemories() {
      return [];
    },
    async createMemoryDocuments(data: any) {
      return data;
    },
    async updateMemoryDocuments(data: any) {
      return data;
    },
    async listMemoryDocuments() {
      return [];
    },

    // ── campañas ──
    async listCampaigns() {
      return [];
    },
    async createCampaigns(data: any) {
      return data;
    },
    async updateCampaigns(data: any) {
      return data;
    },
    async retrieveCampaign() {
      return null;
    },
  };
}

// ── Dobles del modelo ────────────────────────────────────────────────────────

export type ScriptedModel = ModelProvider & {
  /** Requests que recibió, en orden. */
  calls: ChatRequest[];
  /** Texto emitido por `onToken` (para verificar la paridad de streaming). */
  streamed: string[];
};

/**
 * `ModelProvider` con guion: devuelve la n-ésima respuesta programada. Si el loop
 * pide más vueltas que respuestas hay, tira — un guion agotado es un test mal
 * escrito, no un caso a tolerar en silencio.
 */
export function scriptedModel(script: ChatCompletionMessage[]): ScriptedModel {
  let i = 0;
  const calls: ChatRequest[] = [];
  const streamed: string[] = [];
  const next = (req: ChatRequest): ChatCompletionMessage => {
    calls.push(req);
    const msg = script[i++];
    if (!msg) {
      throw new Error(`scriptedModel: se pidió la vuelta ${i} y el guion tiene ${script.length}`);
    }
    return msg;
  };
  return {
    calls,
    streamed,
    async complete(req) {
      return next(req);
    },
    async stream(req, onToken) {
      const msg = next(req);
      // El provider real emite el texto troceado antes de resolver; acá alcanza con
      // un chunk: lo que se verifica es que el streaming no cambie lo que se
      // persiste, no el troceado en sí.
      if (msg.content && onToken) {
        onToken(msg.content);
        streamed.push(msg.content);
      }
      return msg;
    },
  };
}

/** Respuesta de texto plano (cierra el turno). */
export function assistantText(content: string, usage?: ChatUsage): ChatCompletionMessage {
  return { role: 'assistant', content, finish_reason: 'stop', ...(usage ? { usage } : {}) };
}

/** Respuesta con un tool call (el loop ejecuta y sigue). */
export function assistantToolCall(
  name: string,
  args: Record<string, unknown> = {},
  id = 'call_1',
  content: string | null = null,
): ChatCompletionMessage {
  return {
    role: 'assistant',
    content,
    finish_reason: 'tool_calls',
    tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
  };
}

// ── Doble del registry de tools ──────────────────────────────────────────────

export type FakeToolRuntime = ToolRuntime & {
  /** `[name, args]` de cada ejecución, en orden. */
  executed: Array<[string, Record<string, unknown>]>;
};

/**
 * `ToolRuntime` inerte. Es imprescindible, no una comodidad: el registry real
 * levanta el MCP in-process al descubrir tools y deja un handle vivo que impide
 * que el proceso de test termine.
 *
 * `discover` devuelve [] a propósito. Al modelo lo maneja el guion, así que la
 * lista de tools no cambia lo que el loop ejecuta; y así queda explícito que
 * estos tests no dependen del catálogo real de tools.
 */
export function fakeToolRuntime(
  result: string | ((name: string, args: Record<string, unknown>) => string) = 'ok',
): FakeToolRuntime {
  const executed: Array<[string, Record<string, unknown>]> = [];
  return {
    executed,
    async discover() {
      return [];
    },
    async execute(_store, name, args) {
      executed.push([name, args]);
      const text = typeof result === 'function' ? result(name, args) : result;
      return { content: [{ type: 'text', text }] };
    },
  };
}
