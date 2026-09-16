import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type Thread = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
};

/** Archivo adjunto a un mensaje del usuario (imagen para visión o documento). */
export type ChatAttachment = {
  kind: 'image' | 'document';
  url: string;
  file_id?: string | null;
  filename: string;
  mime_type: string;
  text?: string | null;
};

/** Mensaje de texto visible (user o assistant). */
export type Message = {
  kind: 'message';
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'complete' | 'pending' | null;
  /** En mensajes del asistente: key del agente que lo produjo (para su avatar). */
  agent_key?: string | null;
  /** En mensajes del usuario: archivos adjuntos. */
  attachments?: ChatAttachment[] | null;
  created_at?: string;
};

/** Una tool que un agente ejecutó dentro del turno (su "trabajo" visible y persistido). */
export type Activity = {
  kind: 'activity';
  id: string;
  agent_key?: string | null;
  label: string;
  ok: boolean;
};

/** Una derivación de `from` a `target`, con el encargo (`reason`) para el destino. */
export type Handoff = {
  kind: 'handoff';
  id: string;
  from?: string | null;
  target: string;
  reason?: string;
};

/** Ítems del hilo en orden cronológico: texto, actividad de tools y derivaciones. */
export type TimelineItem = Message | Activity | Handoff;

export type PendingToolCall = {
  tool_call_id: string;
  name: string;
  action: string;
  args: Record<string, unknown>;
  kind: 'read' | 'write';
};

export type ThreadView = {
  status?: 'complete' | 'needs_approval' | 'error';
  thread?: Thread;
  messages: TimelineItem[];
  pending: PendingToolCall[];
};

export type ToolMatrixEntry = {
  tool: string;
  resource?: string;
  label: string;
  description?: string;
  actions: Array<{
    action: string;
    kind: 'read' | 'write';
    mode: 'auto' | 'ask' | 'prohibited';
    default: 'auto' | 'ask' | 'prohibited';
  }>;
};

export type McpKey = {
  id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  request_count: number;
  revoked: boolean;
  created_at: string;
};

const THREADS_KEY = 'ai-threads';
const THREAD_KEY = 'ai-thread';
const TOOLS_KEY = 'ai-tools';
const KEYS_KEY = 'ai-mcp-keys';

async function api<T>(url: string, opts: RequestInit & { json?: any } = {}): Promise<T> {
  const { json, ...rest } = opts;
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...rest,
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let message = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed?.message) message = parsed.message;
    } catch {
      if (body) message = body.slice(0, 300);
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

/** Usuario admin logueado (para saludarlo por su nombre en el chat). */
export type AdminUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

export const useMe = () =>
  useQuery({
    queryKey: ['ai-me'],
    queryFn: () => api<{ user: AdminUser }>('/admin/users/me'),
    staleTime: 5 * 60 * 1000,
  });

export const useThreads = () =>
  useQuery({
    queryKey: [THREADS_KEY],
    queryFn: () => api<{ threads: Thread[] }>('/admin/ai-assistant/threads'),
  });

export const useThread = (id: string | null) =>
  useQuery({
    queryKey: [THREAD_KEY, id],
    queryFn: () => api<ThreadView>(`/admin/ai-assistant/threads/${id}`),
    enabled: !!id,
  });

export const useCreateThread = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ thread: Thread }>('/admin/ai-assistant/threads', { method: 'POST', json: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [THREADS_KEY] }),
  });
};

export const useDeleteThread = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/admin/ai-assistant/threads/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [THREADS_KEY] }),
  });
};

export const useSendMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      threadId: string;
      text: string;
      model?: string;
      skill?: string;
      period?: { from: string; to: string } | null;
    }) => {
      const { threadId, ...payload } = vars;
      return api<ThreadView>(`/admin/ai-assistant/threads/${threadId}/messages`, {
        method: 'POST',
        json: payload,
      });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [THREADS_KEY] });
      qc.invalidateQueries({ queryKey: [THREAD_KEY, vars.threadId] });
    },
  });
};

export type WorkflowStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'needs_input'
  | 'failed';

export type WorkflowChecklistItem = {
  key: string;
  agent_key: string;
  label: string;
  status: WorkflowStepStatus;
  result_summary?: string;
};

/** Una fila de actividad real de un subagente del workflow (Cadena de pensamiento). */
export type WorkflowActivity = {
  id: string;
  step_key: string;
  agent_key?: string | null;
  kind: 'search' | 'source' | 'reasoning' | 'tool';
  label: string;
  detail?: string;
  url?: string;
};

/** Eventos del stream SSE del turno (espejo de `AgentEvent` del backend + done/error). */
export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'step'; agent: string }
  | { type: 'tool_call'; name: string; action: string }
  | { type: 'tool_result'; name: string; ok: boolean }
  | { type: 'handoff'; from: string; target: string; reason?: string }
  | { type: 'workflow_started'; run_id: string; workflow_key: string; checklist: WorkflowChecklistItem[] }
  | {
      type: 'workflow_step';
      run_id: string;
      step_key: string;
      agent_key: string;
      label: string;
      status: WorkflowStepStatus;
      result_summary?: string;
    }
  | {
      type: 'workflow_done';
      run_id: string;
      status: 'completed' | 'needs_input' | 'failed';
      artifact?: { preview_url: string; post_id?: string | null };
      unmatched?: string[];
    }
  | { type: 'workflow_message'; run_id: string; agent_key: string; text: string }
  | {
      type: 'workflow_activity';
      run_id: string;
      step_key: string;
      agent_key: string;
      kind: 'search' | 'source' | 'reasoning' | 'tool';
      label: string;
      detail?: string;
      url?: string;
    }
  | {
      type: 'done';
      status?: 'complete' | 'needs_approval' | 'error';
      messages: TimelineItem[];
      pending: PendingToolCall[];
    }
  | { type: 'error'; message: string };

/**
 * Manda un mensaje por la route SSE y va invocando `onEvent` con cada frame a
 * medida que llega. Usa `fetch` + lector de stream (no `EventSource`, que solo
 * soporta GET y no manda body). Cookies same-origin → auth de sesión del admin.
 */
export async function streamMessage(
  vars: {
    threadId: string;
    text: string;
    model?: string;
    skill?: string;
    period?: { from: string; to: string } | null;
    /** Mención `@agente` del composer: el server lo fija como agente activo del turno. */
    agent_key?: string | null;
    /** Adjuntos ya subidos (vía /admin/uploads); el server extrae el texto de docs. */
    attachments?: Array<{
      kind: 'image' | 'document';
      url: string;
      file_id?: string | null;
      filename: string;
      mime_type: string;
    }>;
  },
  onEvent: (ev: StreamEvent) => void,
): Promise<void> {
  const { threadId, ...payload } = vars;
  const res = await fetch(`/admin/ai-assistant/threads/${threadId}/messages/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '');
    let message = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed?.message) message = parsed.message;
    } catch {
      if (body) message = body.slice(0, 300);
    }
    throw new Error(message);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // Frames SSE separadas por línea en blanco (`\n\n`).
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, sep).trim();
      buffer = buffer.slice(sep + 2);
      if (!frame.startsWith('data:')) continue;
      try {
        onEvent(JSON.parse(frame.slice(5).trim()) as StreamEvent);
      } catch {
        // frame incompleto/no-JSON: se ignora
      }
    }
  }
}

export const useConfirmTools = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      threadId: string;
      decisions: Array<{ tool_call_id: string; approved: boolean }>;
      model?: string;
    }) =>
      api<ThreadView>(`/admin/ai-assistant/threads/${vars.threadId}/confirm`, {
        method: 'POST',
        json: { decisions: vars.decisions, model: vars.model },
      }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: [THREAD_KEY, vars.threadId] }),
  });
};

export const useToolsConfig = () =>
  useQuery({
    queryKey: [TOOLS_KEY],
    queryFn: () => api<{ tools: ToolMatrixEntry[] }>('/admin/ai-assistant/tools'),
  });

export const useSaveToolsConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      policies: Array<{ tool_name: string; action: string; resource?: string; mode: string }>,
    ) =>
      api<{ tools: ToolMatrixEntry[] }>('/admin/ai-assistant/tools', {
        method: 'POST',
        json: { policies },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [TOOLS_KEY] }),
  });
};

export const useMcpKeys = () =>
  useQuery({
    queryKey: [KEYS_KEY],
    queryFn: () => api<{ keys: McpKey[] }>('/admin/ai-assistant/keys'),
  });

export const useCreateMcpKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<{ key: McpKey; token: string }>('/admin/ai-assistant/keys', {
        method: 'POST',
        json: { name },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEYS_KEY] }),
  });
};

export const useRevokeMcpKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/admin/ai-assistant/keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEYS_KEY] }),
  });
};

// ── Propuestas (HITL proactivo) ──────────────────────────────────────────────

export type ProposalAction = {
  tool: string;
  args?: Record<string, unknown>;
  label?: string;
};

export type Proposal = {
  id: string;
  agent_key: string;
  thread_id: string | null;
  title: string;
  summary: string;
  rationale: string | null;
  proposed_actions: ProposalAction[] | null;
  expected_impact: Record<string, unknown> | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  source: string;
  created_by: string | null;
  reviewed_by: string | null;
  execution_result: {
    results?: Array<{ tool: string; ok: boolean; text: string }>;
    error?: string;
  } | null;
  created_at: string;
};

const PROPOSALS_KEY = 'ai-proposals';

export const useProposals = (status?: string) =>
  useQuery({
    queryKey: [PROPOSALS_KEY, status ?? 'all'],
    queryFn: () =>
      api<{ proposals: Proposal[] }>(
        `/admin/ai-assistant/proposals${status ? `?status=${status}` : ''}`,
      ),
  });

export const useApproveProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ proposal: Proposal }>(`/admin/ai-assistant/proposals/${id}/approve`, {
        method: 'POST',
        json: {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROPOSALS_KEY] }),
  });
};

export const useRejectProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/admin/ai-assistant/proposals/${id}/reject`, { method: 'POST', json: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROPOSALS_KEY] }),
  });
};

export const useGenerateProposals = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ created: number; proposals: Proposal[] }>(
        '/admin/ai-assistant/proposals/generate',
        { method: 'POST', json: {} },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROPOSALS_KEY] }),
  });
};

// ── Trazabilidad (runs/steps) ────────────────────────────────────────────────

export type AgentRun = {
  id: string;
  thread_id: string | null;
  agent_key: string;
  kind: 'chat' | 'proactive' | 'proposal_exec';
  status: 'running' | 'complete' | 'needs_approval' | 'error';
  model: string | null;
  steps: number;
  prompt_tokens: number;
  completion_tokens: number;
  duration_ms: number | null;
  error: string | null;
  groundedness: { grounded: boolean; score: number; issues: string[] } | null;
  created_at: string;
};

export type AgentStep = {
  id: string;
  run_id: string;
  idx: number;
  type: 'model' | 'tool' | 'handoff';
  agent_key: string | null;
  name: string | null;
  status: string | null;
  duration_ms: number | null;
  tokens: number | null;
  detail: Record<string, unknown> | null;
};

const RUNS_KEY = 'ai-runs';

export const useRuns = () =>
  useQuery({
    queryKey: [RUNS_KEY],
    queryFn: () => api<{ runs: AgentRun[] }>('/admin/ai-assistant/runs'),
  });

export const useRun = (id: string | null) =>
  useQuery({
    queryKey: [RUNS_KEY, id],
    queryFn: () => api<{ run: AgentRun; steps: AgentStep[] }>(`/admin/ai-assistant/runs/${id}`),
    enabled: !!id,
  });

// ── Agentes (CRUD del manifiesto) ────────────────────────────────────────────

export type ToolScope = { tool: string; resources?: string[]; actions?: string[] };

export type Agent = {
  id: string;
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
  skills: string[] | null;
  handoff_targets: string[] | null;
  memory_types: string[] | null;
  source: string;
};

export type Skill = {
  id: string;
  key: string;
  name: string;
  instructions: string;
  enabled: boolean;
};

export type AgentInput = {
  key?: string;
  name: string;
  description?: string | null;
  instructions: string;
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

const AGENTS_KEY = 'ai-agents';
const SKILLS_KEY = 'ai-skills';

export const useAgents = () =>
  useQuery({
    queryKey: [AGENTS_KEY],
    queryFn: () => api<{ agents: Agent[] }>('/admin/ai-assistant/agents'),
  });

export const useSkills = () =>
  useQuery({
    queryKey: [SKILLS_KEY],
    queryFn: () => api<{ skills: Skill[] }>('/admin/ai-assistant/skills'),
  });

export type SkillInput = {
  key?: string;
  name: string;
  instructions: string;
  enabled?: boolean;
};

export const useSaveSkill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id?: string; input: SkillInput }) =>
      api<{ skill: Skill }>(
        vars.id ? `/admin/ai-assistant/skills/${vars.id}` : '/admin/ai-assistant/skills',
        { method: 'POST', json: vars.input },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SKILLS_KEY] }),
  });
};

export const useDeleteSkill = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/admin/ai-assistant/skills/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SKILLS_KEY] }),
  });
};

export const useSaveAgent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id?: string; input: AgentInput }) =>
      api<{ agent: Agent }>(
        vars.id ? `/admin/ai-assistant/agents/${vars.id}` : '/admin/ai-assistant/agents',
        { method: 'POST', json: vars.input },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [AGENTS_KEY] }),
  });
};

export const useDeleteAgent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/admin/ai-assistant/agents/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [AGENTS_KEY] }),
  });
};

export type AgentDraft = {
  name: string;
  description: string;
  instructions: string;
};

/** "Generar con IA": de una descripción en una línea a un borrador de agente. */
export const useDraftAgent = () =>
  useMutation({
    mutationFn: (prompt: string) =>
      api<{ draft: AgentDraft }>('/admin/ai-assistant/draft-agent', {
        method: 'POST',
        json: { prompt },
      }),
  });

// ── MCP externos (servidores de terceros) ────────────────────────────────────

export type McpServerTool = {
  name: string;
  namespaced_name: string;
  description: string | null;
  read_only_hint: boolean;
};

export type McpServer = {
  trust_read_only_hints?: boolean;
  id: string;
  key: string;
  name: string;
  url: string;
  avatar_url: string | null;
  transport: 'http' | 'sse';
  auth_type: 'none' | 'bearer' | 'header' | 'oauth';
  auth_header_name: string | null;
  enabled: boolean;
  has_secret: boolean;
  oauth_client_id: string | null;
  oauth_scope: string | null;
  oauth_connected: boolean;
  tools_count: number;
  tools: McpServerTool[];
  health: 'unknown' | 'ok' | 'error';
  last_error: string | null;
  last_connected_at: string | null;
  last_discovered_at: string | null;
  created_at: string;
};

export type McpServerInput = {
  trust_read_only_hints?: boolean;
  key?: string;
  name: string;
  url: string;
  avatar_url?: string | null;
  transport?: 'http' | 'sse';
  auth_type?: 'none' | 'bearer' | 'header' | 'oauth';
  auth_header_name?: string | null;
  /** Secreto en claro: solo de envío; vacío en edición = no se cambia. */
  secret?: string | null;
  oauth_client_id?: string | null;
  oauth_client_secret?: string | null;
  oauth_scope?: string | null;
  enabled?: boolean;
};

const MCP_SERVERS_KEY = 'ai-mcp-servers';

export const useMcpServers = () =>
  useQuery({
    queryKey: [MCP_SERVERS_KEY],
    queryFn: () => api<{ servers: McpServer[] }>('/admin/ai-assistant/mcp-servers'),
  });

export const useSaveMcpServer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id?: string; input: McpServerInput }) =>
      api<{ server: McpServer }>(
        vars.id ? `/admin/ai-assistant/mcp-servers/${vars.id}` : '/admin/ai-assistant/mcp-servers',
        { method: 'POST', json: vars.input },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MCP_SERVERS_KEY] }),
  });
};

export const useDeleteMcpServer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/admin/ai-assistant/mcp-servers/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MCP_SERVERS_KEY] }),
  });
};

export const useRefreshMcpServer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean; tools_count: number; error?: string; server: McpServer | null }>(
        `/admin/ai-assistant/mcp-servers/${id}/refresh`,
        { method: 'POST', json: {} },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MCP_SERVERS_KEY] }),
  });
};

export const useStartMcpOAuth = () =>
  useMutation({
    mutationFn: (id: string) =>
      api<{ authorization_url: string; redirect_uri: string }>(
        `/admin/ai-assistant/mcp-servers/${id}/oauth/start`,
        { method: 'POST', json: {} },
      ),
  });

// ─── Memoria ──────────────────────────────────────────────────────────────────

export const ALL_MEMORY_TYPES = [
  'business_rule',
  'decision',
  'preference',
  'campaign_learning',
  'product_context',
  'customer_segment_context',
  'brand_guideline',
  'operational_policy',
  'conversation_learning',
  'proposal_feedback',
  'document_chunk',
  'faq',
  'system_note',
] as const;

export const MEMORY_TYPE_LABELS: Record<string, string> = {
  business_rule: 'Regla de negocio',
  decision: 'Decisión',
  preference: 'Preferencia',
  campaign_learning: 'Aprendizaje de campaña',
  product_context: 'Contexto de producto',
  customer_segment_context: 'Segmento de clientes',
  brand_guideline: 'Lineamiento de marca',
  operational_policy: 'Política operativa',
  conversation_learning: 'Aprendizaje de conversación',
  proposal_feedback: 'Feedback de propuesta',
  document_chunk: 'Fragmento de documento',
  faq: 'FAQ',
  system_note: 'Nota del sistema',
};

export type Memory = {
  id: string;
  tenant_id: string;
  agent_key: string | null;
  memory_type: string;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  content: string;
  summary: string | null;
  metadata: any;
  tags: string[] | null;
  source: string;
  source_ref_id: string | null;
  importance_score: number;
  confidence_score: number;
  status: 'pending' | 'active' | 'archived';
  embedding_model: string | null;
  embedded_at: string | null;
  created_by: string | null;
  last_used_at: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
};

export type MemoryFilters = {
  q?: string;
  agent_key?: string;
  memory_type?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

const MEMORY_KEY = 'ai-memory';

export const useMemories = (filters: MemoryFilters = {}) => {
  const qs = new URLSearchParams();
  if (filters.q) qs.set('q', filters.q);
  if (filters.agent_key) qs.set('agent_key', filters.agent_key);
  if (filters.memory_type) qs.set('memory_type', filters.memory_type);
  if (filters.status) qs.set('status', filters.status);
  if (filters.limit != null) qs.set('limit', String(filters.limit));
  if (filters.offset != null) qs.set('offset', String(filters.offset));
  const url = qs.toString() ? `/admin/ai-assistant/memory?${qs.toString()}` : '/admin/ai-assistant/memory';
  return useQuery({
    queryKey: [MEMORY_KEY, filters],
    queryFn: () => api<{ memories: Memory[]; count: number }>(url),
  });
};

export type CreateMemoryInput = {
  memory_type: string;
  title: string;
  content: string;
  summary?: string | null;
  agent_key?: string | null;
  tags?: string[] | null;
  importance_score?: number;
};

export const useCreateMemory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMemoryInput) =>
      api<{ memory: Memory }>('/admin/ai-assistant/memory', { method: 'POST', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MEMORY_KEY] }),
  });
};

export const useUpdateMemory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<CreateMemoryInput> & { status?: string }) =>
      api<{ memory: Memory }>(`/admin/ai-assistant/memory/${id}`, { method: 'POST', json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MEMORY_KEY] }),
  });
};

export const useDeleteMemory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ deleted: boolean }>(`/admin/ai-assistant/memory/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MEMORY_KEY] }),
  });
};

export const useMemoryFeedback = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, useful }: { id: string; useful: boolean }) =>
      api<{ memory: Memory }>(`/admin/ai-assistant/memory/${id}/feedback`, {
        method: 'POST',
        json: { useful },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MEMORY_KEY] }),
  });
};

export type MemorySearchResult = {
  id: string;
  memory_type: string;
  title: string;
  text: string;
  similarity: number;
};

export const useSearchMemory = () =>
  useMutation({
    mutationFn: (input: { query: string; agent_key?: string | null; limit?: number }) =>
      api<{ results: MemorySearchResult[] }>('/admin/ai-assistant/memory/search', {
        method: 'POST',
        json: input,
      }),
  });

// ─── Documentos (contexto por agente) ─────────────────────────────────────────

export type MemoryDocument = {
  id: string;
  agent_key: string | null;
  title: string;
  original_filename: string | null;
  mime_type: string;
  content_hash: string;
  char_count: number;
  chunk_count: number;
  status: 'processing' | 'ready' | 'failed';
  error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const DOCUMENTS_KEY = 'ai-documents';

export const useAgentDocuments = (agentId: string | null) =>
  useQuery({
    queryKey: [DOCUMENTS_KEY, agentId],
    enabled: Boolean(agentId),
    queryFn: () =>
      api<{ documents: MemoryDocument[] }>(`/admin/ai-assistant/agents/${agentId}/documents`),
  });

export type UploadDocumentInput = {
  agentId: string;
  filename: string;
  mimeType: string;
  content: string; // base64
  title?: string;
};

export const useUploadAgentDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, ...body }: UploadDocumentInput) =>
      api<{ document: MemoryDocument }>(`/admin/ai-assistant/agents/${agentId}/documents`, {
        method: 'POST',
        json: body,
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [DOCUMENTS_KEY, vars.agentId] });
      qc.invalidateQueries({ queryKey: [MEMORY_KEY] });
    },
  });
};

export const useDeleteDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ deleted: boolean }>(`/admin/ai-assistant/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DOCUMENTS_KEY] });
      qc.invalidateQueries({ queryKey: [MEMORY_KEY] });
    },
  });
};

// ── Workflows (definiciones orquestadas) ─────────────────────────────────────

export type WorkflowStep = {
  result_contract?: Record<string, { type: 'string' | 'strings' | 'boolean'; minItems?: number; equals?: boolean }>;
  key: string;
  agent_key: string;
  task: string;
  parallel_group?: string | number | null;
  requires_approval?: boolean;
  output_key?: string;
  label?: string;
};

export type WorkflowDefinition = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  steps: WorkflowStep[];
  final_action: { type: string } | null;
  source: string;
};

export type WorkflowInput = {
  key?: string;
  name: string;
  description?: string | null;
  enabled?: boolean;
  steps: WorkflowStep[];
  final_action?: { type: string } | null;
};

const WORKFLOWS_KEY = 'ai-workflows';

export const useWorkflows = () =>
  useQuery({
    queryKey: [WORKFLOWS_KEY],
    queryFn: () => api<{ workflows: WorkflowDefinition[] }>('/admin/ai-assistant/workflows'),
  });

export const useSaveWorkflow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id?: string; input: WorkflowInput }) =>
      api<{ workflow: WorkflowDefinition }>(
        vars.id ? `/admin/ai-assistant/workflows/${vars.id}` : '/admin/ai-assistant/workflows',
        { method: 'POST', json: vars.input },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [WORKFLOWS_KEY] }),
  });
};

export const useDeleteWorkflow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/admin/ai-assistant/workflows/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [WORKFLOWS_KEY] }),
  });
};
