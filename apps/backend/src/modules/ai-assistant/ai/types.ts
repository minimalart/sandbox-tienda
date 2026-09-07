/** Tipos compartidos del Asistente IA (formato OpenAI/OpenRouter chat-completions). */

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** JSON string con los argumentos, tal cual lo devuelve el modelo. */
    arguments: string;
  };
};

/**
 * Partes de contenido multimodal (formato OpenAI/OpenRouter). Cuando un mensaje
 * del usuario lleva imágenes adjuntas, su `content` deja de ser un string y pasa
 * a ser un array de partes (texto + image_url) para que el modelo "vea" la imagen.
 */
export type TextContentPart = { type: 'text'; text: string };
export type ImageContentPart = { type: 'image_url'; image_url: { url: string } };
export type ContentPart = TextContentPart | ImageContentPart;

/** Mensaje en formato API (lo que se manda/recibe de OpenRouter). */
export type ApiMessage = {
  role: ChatRole;
  content: string | ContentPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

/**
 * Archivo adjunto a un mensaje del usuario. Las imágenes se pasan al modelo como
 * `image_url` (visión); los documentos (PDF/TXT/MD) se parsean a texto y ese texto
 * se inyecta como contexto del mensaje. `text` se computa server-side al adjuntar
 * (solo documentos) y queda persistido para no reparsear al recargar el hilo.
 */
export type ChatAttachment = {
  kind: 'image' | 'document';
  url: string;
  file_id?: string | null;
  filename: string;
  mime_type: string;
  text?: string | null;
};

export type PolicyMode = 'auto' | 'ask' | 'prohibited';

/** Tool call propuesto que requiere confirmación del usuario (modo "consulta"). */
export type PendingToolCall = {
  tool_call_id: string;
  name: string;
  action: string;
  args: Record<string, unknown>;
  kind: 'read' | 'write';
};

export type AgentResult =
  | { status: 'complete' }
  | { status: 'needs_approval'; pending: PendingToolCall[] }
  | { status: 'error'; message: string };

/**
 * Eventos que el loop emite en vivo cuando se corre con streaming (route SSE).
 * El loop sincrónico (no-streaming) no los emite: la persistencia de mensajes y el
 * `AgentResult` final son idénticos en ambos modos.
 *  - `token`: fragmento de texto del assistant a medida que llega del modelo.
 *  - `reasoning`: fragmento del razonamiento del modelo (CoT/resumen) a medida que
 *    llega. Es EFÍMERO: se muestra en vivo pero NO se persiste (no queda al recargar).
 *  - `tool_call`: el assistant decidió usar una tool (señala fin del preámbulo).
 *  - `tool_result`: terminó la ejecución de una tool (ok/error).
 *  - `handoff`: la conversación se derivó de `from` a `target`; `reason` es el
 *    encargo que el agente origen le deja al destino (se muestra como diálogo).
 *  - `step`: arranca una nueva vuelta del modelo (el cliente limpia el buffer).
 */
export type AgentEvent =
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
      /** Artefacto principal del workflow (p. ej. el borrador) para surfacear su preview al cerrar. */
      artifact?: { preview_url: string; post_id?: string | null };
      /** Ingredientes/insumos principales que ningún step pudo asociar a un producto (si aplica). */
      unmatched?: string[];
    }
  | { type: 'workflow_message'; run_id: string; agent_key: string; text: string }
  | {
      /**
       * Actividad REAL de un subagente headless del workflow (búsqueda web, fuente
       * hallada, uso de tool, razonamiento) surfaceada en vivo. Alimenta la "Cadena de
       * pensamiento" del chat, que reemplaza a los hints hardcodeados. Se agrupa por
       * `step_key`. Efímero: no se persiste (igual que `reasoning`).
       */
      type: 'workflow_activity';
      run_id: string;
      step_key: string;
      agent_key: string;
      kind: 'search' | 'source' | 'reasoning' | 'tool';
      /** Etiqueta lista para mostrar (p. ej. 'Buscando en la web: milanesa'). */
      label: string;
      /** Detalle secundario opcional (p. ej. 'openai.com'). */
      detail?: string;
      /** URL fuente clickeable (para kind 'source'). */
      url?: string;
    };

/** Estado de un paso del checklist de un workflow. */
export type WorkflowStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'needs_input'
  | 'failed';

/** Item del checklist que mantiene el Orquestador y muestra la UI. */
export type WorkflowChecklistItem = {
  key: string;
  agent_key: string;
  label: string;
  status: WorkflowStepStatus;
  result_summary?: string;
};

// ── Contrato de persistencia ────────────────────────────────────────────────

/**
 * Persistencia mínima que necesita el agente (la cumple el service del módulo).
 * Se tipa estructuralmente para no atarse a los tipos generados por MedusaService.
 */
export interface AiStore {
  listChatMessages(filters: any, config?: any): Promise<any[]>;
  createChatMessages(data: any): Promise<any>;
  updateChatMessages(data: any): Promise<any>;
  listToolPolicies(filters?: any, config?: any): Promise<any[]>;
  // Registry de agentes (lo usa `resolveActiveAgent`). Métodos autogenerados por
  // MedusaService; se tipan estructuralmente para no atarse a los tipos generados.
  retrieveChatThread(id: string): Promise<any>;
  updateChatThreads(data: any): Promise<any>;
  listAgents(filters?: any, config?: any): Promise<any[]>;
  retrieveAgent(id: string): Promise<any>;
  listSkills(filters?: any, config?: any): Promise<any[]>;
  // Trazabilidad (lo usa `RunTracer`). Best-effort: la traza nunca rompe el turno.
  createAgentRuns(data: any): Promise<any>;
  updateAgentRuns(data: any): Promise<any>;
  createAgentSteps(data: any): Promise<any>;
  // Servidores MCP externos (los usa el agregador `tool-registry`).
  listMcpServers(filters?: any, config?: any): Promise<any[]>;
  retrieveMcpServer(id: string): Promise<any>;
  updateMcpServers(data: any): Promise<any>;
  // Memoria vectorizada (la usan `retrieveMemories`/`saveMemory`/`touchMemories`).
  createAgentMemories(data: any): Promise<any>;
  updateAgentMemories(data: any): Promise<any>;
  listAgentMemories(filters?: any, config?: any): Promise<any[]>;
  createMemoryDocuments(data: any): Promise<any>;
  updateMemoryDocuments(data: any): Promise<any>;
  listMemoryDocuments(filters?: any, config?: any): Promise<any[]>;
  // Campaña comercial (estado compartido del wizard guiado; ver `ai/campaign.ts`).
  listCampaigns(filters?: any, config?: any): Promise<any[]>;
  createCampaigns(data: any): Promise<any>;
  updateCampaigns(data: any): Promise<any>;
  retrieveCampaign(id: string): Promise<any>;
}

// ── Config de memoria del turno ─────────────────────────────────────────────

/**
 * Config de memoria del turno, resuelta desde store-config en la route. Si
 * `enabled` es false, el loop corre EXACTAMENTE como antes (regresión cero).
 */
export type MemoryRuntimeOptions = {
  enabled: boolean;
  autocaptureEnabled: boolean;
  autocaptureRequiresApproval: boolean;
  topK: number;
  minSimilarity: number;
  tenantId: string;
  createdBy?: string | null;
};

/** Subconjunto de `AiConfig` (store-config) que necesita la memoria. */
export type MemoryConfigInput = {
  memory_enabled: boolean;
  memory_autocapture_enabled: boolean;
  memory_autocapture_requires_approval: boolean;
  memory_retrieval_topk: number;
  memory_min_similarity: number;
};

// ── Overrides de la route ───────────────────────────────────────────────────

/** Overrides de IA del Asistente, resueltos desde store-config en la route. */
export type ChatOverrides = {
  model?: string;
  maxTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
};

// ── Vista de la UI del admin ────────────────────────────────────────────────

/**
 * Ítems que consume la UI del admin, en orden cronológico. Un hilo ya no es solo
 * una lista de mensajes de texto: incluye la ACTIVIDAD del equipo (tools que se
 * ejecutaron) y las DERIVACIONES entre agentes, para que "el trabajo quede a la
 * vista" al recargar (no solo en vivo). Todo se deriva de filas ya persistidas
 * (assistant.tool_calls + filas `tool`), así que no hace falta nueva tabla.
 */
export type ClientMessage = {
  kind: 'message';
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'complete' | 'pending' | null;
  /** En filas `assistant`: key del agente que la produjo (para su avatar). */
  agent_key?: string | null;
  /** En filas `user`: archivos adjuntos (para mostrarlos al recargar el hilo). */
  attachments?: ChatAttachment[] | null;
  created_at?: string | Date;
};

/** Una tool que un agente ejecutó dentro del turno (su "trabajo" visible). */
export type ClientActivity = {
  kind: 'activity';
  id: string;
  agent_key?: string | null;
  /** Etiqueta humana en español, p. ej. "Consultó Productos". */
  label: string;
  /** false si la tool devolvió error / fue rechazada / prohibida. */
  ok: boolean;
};

/** Una derivación de `from` a `target`, con el encargo (`reason`) para el destino. */
export type ClientHandoff = {
  kind: 'handoff';
  id: string;
  from?: string | null;
  target: string;
  reason?: string;
};

export type TimelineItem = ClientMessage | ClientActivity | ClientHandoff;

/** Fila de la matriz de capacidades de la pantalla de Configuración. */
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

/** Acción propuesta dentro de una Propuesta: un tool call del MCP listo para
 * ejecutar (los `args` incluyen `action`/`resource`). */
export type ProposedAction = {
  tool: string;
  args?: Record<string, unknown>;
  label?: string;
};
