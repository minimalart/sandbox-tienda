/**
 * Los dos loops SIN hilo persistido: el análisis headless (job de propuestas y
 * subagentes del motor de workflows) y el bot de atención por WhatsApp.
 *
 * Viven juntos y comparten `runStatelessTurn` porque eran el mismo loop copiado
 * dos veces. Una vez que la transcripción pasó a ser un sink del stream de
 * eventos, la diferencia se redujo a tres literales: el texto con que se rechaza
 * una acción no permitida, un gate extra sobre las tools nativas, y la
 * instrucción de cierre cuando se agotan los pasos. Todo lo demás —armado del
 * request, clasificación por policy, tools sintéticas de memoria, emisión de
 * hechos— era idéntico carácter por carácter.
 *
 * El loop del chat (`runLoop`, en `agent.ts`) NO se pliega acá, y es a propósito:
 * su historial vive en `chat_message` y se relee en cada vuelta, re-resuelve el
 * agente activo por paso (eso es lo que hace posible el handoff), puede SUSPENDER
 * el turno esperando aprobación humana y valida el grounding de la respuesta.
 * Son responsabilidades distintas, no parámetros; meterlas acá daría una función
 * con media docena de condicionales estructurales en vez de una abstracción.
 *
 * Este módulo además rompe el último ciclo de imports del asistente:
 * `workflow-engine` y `proposal-engine` importan de acá y no de `agent.ts`.
 *
 *   types <- memory <- runtime <- { agent, headless } <- { workflow-engine,
 *   proposal-engine } <- rutas
 */
import {
  defaultModelProvider,
  type ChatRequest,
  type ModelProvider,
  type OpenAiTool,
} from './chat-client';
import { defaultToolRuntime, type ToolRuntime } from './tool-registry';
import {
  actionFromArgs,
  resolveMode,
  resourceFromArgs,
  SEARCH_MEMORY_TOOL,
  type PolicyOverride,
} from './policy';
import { embedText, retrieveMemories, touchMemories } from './memory';
import { resolveAgentByKey, type ResolvedAgent } from './agents';
import { comboAllowed, scopeFor, type ToolCapability } from './capabilities';
import { NO_HOOKS, type AgentHooks, type HookAgent } from './hooks';
import { buildSystemPrompt } from './prompt';
import { analysisPreset, whatsappPreset } from './presets';
import { EventBus, type ClassifiedToolCall, type RunEventSink } from './run-events';
import type { RunStatus } from './tracing';
import { WORKFLOW_RESULT_INSTRUCTIONS, blockedResult, parseWorkflowResult, validateWorkflowResult, type ResultContract } from './workflow-result';
import {
  buildToolsForModel,
  effectiveMemoryTypes,
  execTool,
  loadOverrides,
  runSearchMemoryTool,
  safeParseArgs,
  userContent,
} from './runtime';
import type { NativeToolContext } from './native-tools';
import { isNativeToolBlockedInAnalysis, type NativeToolsPolicy } from './native-tools/names';
import type {
  AgentEvent,
  AiStore,
  ApiMessage,
  ChatAttachment,
  MemoryRuntimeOptions,
} from './types';

/** Lo que hay que decidir para correr un turno sin hilo. */
type StatelessTurn = {
  workflow?: { contract?: ResultContract };
  store: AiStore;
  llm: ModelProvider;
  toolRt: ToolRuntime;
  overrides: PolicyOverride[];
  agent: ResolvedAgent;
  bus: EventBus;
  /** Historial vivo. El `ArrayTranscript` del bus escribe sobre este array. */
  messages: ApiMessage[];
  tools: OpenAiTool[];
  model?: string;
  maxTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  maxSteps: number;
  memory?: MemoryRuntimeOptions;
  nativeCtx?: NativeToolContext;
  /** Memorias que influyeron; se les marca el uso al cerrar. */
  injectedIds: Set<string>;
  /** Texto de la fila `tool` cuando la llamada no se ejecuta. */
  refusal: string;
  /** Gate extra sobre lo que la policy dejaría pasar (p. ej. nativas en análisis). */
  blocked?: (name: string) => boolean;
  /**
   * Superficie de tools que este driver declara. TIENE que ser la misma que se le
   * pasó a `buildToolsForModel`: si el listado abre toda la superficie y el gate
   * de ejecución mira el allow-list del agente, el analista ve tools que después
   * no puede correr. Pasarla explícita es lo que mantiene los dos extremos
   * coherentes.
   */
  capability: ToolCapability;
  /** Interceptores. El contrato del runtime exige que los dos drivers los respeten. */
  hooks: AgentHooks;
  /** Qué pedirle al modelo cuando se agotan los pasos. */
  closing: string;
};

/**
 * Un turno agéntico sin hilo persistido. Devuelve el texto final.
 *
 * A diferencia del chat, acá NO hay suspensión por aprobación: lo que la policy
 * no marca `auto` simplemente no corre y se le explica al modelo, que sigue con
 * lo que tenga. Es la garantía dura de los dos llamadores —el analista propone en
 * vez de ejecutar, el bot lee y no escribe— y por eso el rechazo es un `refusal`
 * obligatorio y no un opcional.
 */
async function runStatelessTurn(t: StatelessTurn): Promise<string> {
  const { store, llm, toolRt, overrides, agent, bus, messages, tools, memory, injectedIds } = t;
  const memTenant = memory?.tenantId ?? 'default';
  const capability = t.capability;
  let finalStatus: RunStatus = 'complete';
  let errorMsg: string | undefined;
  const finish = (text: string): string => {
    if (!t.workflow) return text;
    const result = validateWorkflowResult(parseWorkflowResult(text), t.workflow.contract);
    if (result.ok) return '<result>' + JSON.stringify(result.data) + '</result>';
    finalStatus = result.block.code === 'permissions_blocked' ? 'needs_approval' : 'error';
    errorMsg = result.block.reason;
    return '<result>' + JSON.stringify(result.block) + '</result>';
  };

  const hooks = t.hooks;
  const hookAgent: HookAgent = { key: agent.key, model: t.model, maxTokens: t.maxTokens };

  try {
    await bus.emit({ type: 'turn_started', at: Date.now(), maxSteps: t.maxSteps });
    for (let step = 0; step < t.maxSteps; step++) {
      const stepCtx = { run: bus.meta, step, maxSteps: t.maxSteps, agent: hookAgent };
      if (hooks.beforeStep) {
        const decision = await hooks.beforeStep(stepCtx);
        if (decision?.stop) return finish(decision.message ?? '');
      }
      await bus.emit({ type: 'step_started', at: Date.now(), idx: step, agentKey: agent.key });
      let request: ChatRequest = {
        model: t.model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        maxTokens: t.maxTokens,
        reasoningEffort: t.reasoningEffort,
      };
      if (hooks.beforeModelRequest) {
        const patch = await hooks.beforeModelRequest({ ...stepCtx, purpose: 'step', request });
        if (patch) request = patch.request;
      }
      const modelStart = Date.now();
      const assistant = await llm.complete(request);
      await bus.emit({
        type: 'model_completed',
        at: Date.now(),
        idx: step,
        agentKey: agent.key,
        model: t.model,
        purpose: 'step',
        durationMs: Date.now() - modelStart,
        promptTokens: assistant.usage?.prompt_tokens,
        completionTokens: assistant.usage?.completion_tokens,
        finishReason: assistant.finish_reason,
      });

      if (!assistant.tool_calls || assistant.tool_calls.length === 0) {
        if (hooks.beforeTurnStop) {
          const decision = await hooks.beforeTurnStop({
            run: bus.meta,
            reason: 'no_tool_calls',
            steps: step + 1,
            agent: hookAgent,
            draft: { status: 'complete' },
          });
          if (decision?.continue) continue;
        }
        await bus.emit({
          type: 'step_completed',
          at: Date.now(),
          idx: step,
          agentKey: agent.key,
          outcome: 'answered',
        });
        return finish(assistant.content ?? '');
      }

      await bus.emit({
        type: 'assistant_message',
        at: Date.now(),
        agentKey: agent.key,
        content: assistant.content ?? '',
        toolCalls: assistant.tool_calls,
        status: 'complete',
      });

      const policyTools = await toolRt.discover(store);
      for (const tc of assistant.tool_calls) {
        const args = safeParseArgs(tc.function.arguments);
        const action = actionFromArgs(args);
        const resource = resourceFromArgs(args);
        // La capability del driver sólo puede angostar lo que la ToolPolicy permite.
        const scope = scopeFor(capability, tc.function.name);
        const mode =
          !scope || !comboAllowed(scope, action, resource || null)
            ? ('prohibited' as const)
            : resolveMode(tc.function.name, action, resource, overrides, policyTools.find(t => t.definition.name === tc.function.name)?.policyHints);
        const call: ClassifiedToolCall = {
          id: tc.id,
          name: tc.function.name,
          args,
          action,
          resource,
          mode,
        };
        const toolStart = Date.now();
        await bus.emit({ type: 'tool_called', at: Date.now(), agentKey: agent.key, call });

        const toolCtx = {
          ...stepCtx,
          call,
          synthetic:
            tc.function.name === SEARCH_MEMORY_TOOL ? ('search_memory' as const) : null,
        };
        let hookSkip: { skip: true; result: string } | null = null;
        if (hooks.beforeToolExecute) {
          const decision = await hooks.beforeToolExecute(toolCtx);
          if (decision && 'skip' in decision) hookSkip = decision;
          else if (decision && 'args' in decision) call.args = decision.args;
        }
        let text: string;
        let executed = true;
        if (hookSkip) {
          text = hookSkip.result;
        } else if (tc.function.name === SEARCH_MEMORY_TOOL) {
          const r = await runSearchMemoryTool(store, args, {
            tenantId: memTenant,
            agentKey: agent.key,
            memoryTypes: effectiveMemoryTypes(agent.memoryTypes),
            minSimilarity: memory?.minSimilarity ?? 0.35,
          });
          text = r.text;
          for (const id of r.ids) injectedIds.add(id);
        } else if (mode === 'auto' && !t.blocked?.(tc.function.name)) {
          text = await execTool(store, toolRt, tc.function.name, call.args, t.nativeCtx);
        } else {
          executed = false;
          const cause = !scope || !comboAllowed(scope, action, resource || null)
            ? 'El perfil del agente no permite esta herramienta o acción.'
            : mode === 'prohibited' ? 'La política del administrador prohíbe esta acción.'
            : mode === 'ask' ? 'La política requiere confirmación humana y el workflow automático no puede concederla.'
            : 'La herramienta está deshabilitada en este modo de análisis.';
          text = t.workflow
            ? 'Bloqueado por permisos: ' + tc.function.name + '. ' + cause
            : t.refusal + ' Causa: ' + cause;
        }
        if (hooks.afterToolExecute) {
          const patch = await hooks.afterToolExecute({
            ...toolCtx,
            result: text,
            ok: executed && !text.startsWith('Error'),
            durationMs: Date.now() - toolStart,
          });
          if (patch) text = patch.result;
        }

        await bus.emit(
          executed
            ? {
                type: 'tool_completed',
                at: Date.now(),
                agentKey: agent.key,
                call,
                text,
                ok: !text.startsWith('Error'),
                durationMs: Date.now() - toolStart,
              }
            : {
                type: 'tool_rejected',
                at: Date.now(),
                agentKey: agent.key,
                call,
                by: 'policy',
                text,
              },
        );
        if (!executed && t.workflow) {
          return finish('<result>' + JSON.stringify(blockedResult('permissions_blocked', text)) + '</result>');
        }
      }
      await bus.emit({
        type: 'step_completed',
        at: Date.now(),
        idx: step,
        agentKey: agent.key,
        outcome: 'tools',
      });
    }

    if (hooks.beforeTurnStop) {
      // `continue` se ignora acá, igual que en el chat: extender el turno
      // derrotaría el tope de pasos.
      await hooks.beforeTurnStop({
        run: bus.meta,
        reason: 'max_steps',
        steps: t.maxSteps,
        agent: hookAgent,
        draft: { status: 'complete' },
      });
    }

    // Se agotaron los pasos: cerrar SIN más tool calls, con lo que ya se juntó.
    const closingStart = Date.now();
    const closing = await llm.complete({
      model: t.model,
      messages: [...messages, { role: 'user', content: t.closing }],
      maxTokens: t.maxTokens,
      reasoningEffort: t.reasoningEffort,
    });
    await bus.emit({
      type: 'model_completed',
      at: Date.now(),
      idx: t.maxSteps,
      agentKey: agent.key,
      model: t.model,
      purpose: 'closing',
      durationMs: Date.now() - closingStart,
      promptTokens: closing.usage?.prompt_tokens,
      completionTokens: closing.usage?.completion_tokens,
      finishReason: closing.finish_reason,
    });
    return finish(closing.content ?? '');
  } catch (e) {
    finalStatus = 'error';
    errorMsg = (e as Error).message;
    throw e;
  } finally {
    if (injectedIds.size > 0) {
      const ids = [...injectedIds];
      await bus.emit({ type: 'memory_retrieved', at: Date.now(), agentKey: agent.key, ids });
      await touchMemories(store, ids);
    }
    await bus.emit({ type: 'turn_completed', at: Date.now(), status: finalStatus, error: errorMsg });
  }
}

/** Recupera memoria para el prompt inicial. Best-effort: un fallo deja el turno sin RAG. */
async function seedMemory(
  store: AiStore,
  agent: ResolvedAgent,
  query: string,
  memory: MemoryRuntimeOptions | undefined,
  injectedIds: Set<string>,
): Promise<string[]> {
  if (!memory?.enabled) return [];
  try {
    const mems = await retrieveMemories(store, {
      tenantId: memory.tenantId ?? 'default',
      agentKey: agent.key,
      memoryTypes: effectiveMemoryTypes(agent.memoryTypes),
      queryEmbedding: await embedText(query),
      topK: memory.topK ?? 5,
      minSimilarity: memory.minSimilarity,
    });
    for (const m of mems) injectedIds.add(m.id);
    return mems.map((m) => m.text);
  } catch {
    return [];
  }
}

/**
 * Corre un agente en modo headless para análisis proactivo: arma su prompt +
 * tools (sin handoff), lo deja usar SOLO lecturas para juntar datos, y devuelve el
 * texto final. Las escrituras NO se ejecutan: el agente debe PROPONERLAS en el
 * output (las corre un humano al aprobar la Propuesta). Lo usan el job
 * `generate-proposals` y los subagentes del motor de workflows.
 */
export async function runHeadlessAnalysis(opts: {
  workflowContract?: ResultContract;
  store: AiStore;
  agentKey: string;
  task: string;
  model?: string;
  maxTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  maxSteps?: number;
  memory?: MemoryRuntimeOptions;
  /** Seam del modelo. Default: OpenRouter. Los tests inyectan un doble con guion. */
  modelProvider?: ModelProvider;
  /** Seam de tools (descubrimiento + ejecución). Default: el registry real. */
  toolRuntime?: ToolRuntime;
  /** Container para tools nativas (image/blog) cuando el subagente las ejecuta. */
  nativeCtx?: NativeToolContext;
  /** Gate de tools nativas: 'all' (default) o 'analysis-only' (sólo lectura). */
  nativeToolsPolicy?: NativeToolsPolicy;
  /** Adjuntos (imágenes) que el subagente recibe como contexto visual del pedido. */
  attachments?: ChatAttachment[] | null;
  /** Emisor de eventos en vivo (para surfacear la actividad del subagente en la UI). */
  onEvent?: (ev: AgentEvent) => void;
  /** Interceptores del loop. Sin ellos el comportamiento es exactamente el de hoy. */
  hooks?: AgentHooks;
  /** Observadores del stream de eventos. No alteran el turno. */
  observers?: RunEventSink[];
  /** Etiqueta la actividad con el run/step del workflow (para agruparla en la UI). */
  activityContext?: { runId: string; stepKey: string };
}): Promise<string> {
  const { store, agentKey, task, memory } = opts;
  const toolRt = opts.toolRuntime ?? defaultToolRuntime;
  const overrides = await loadOverrides(store);
  const agent = await resolveAgentByKey(store, agentKey);
  const injectedIds = new Set<string>();

  // Para PROPONER acciones el analista ve TODA la superficie de tools (read+write,
  // menos las prohibidas globalmente) y no sólo su allow-list de chat: así puede
  // proponer crear promos, ajustar precios, reponer inventario. Las escrituras no
  // se ejecutan acá.
  const allowedTools = opts.activityContext ? agent.allowedTools : null;
  const tools = await buildToolsForModel(store, toolRt, overrides, allowedTools, [], {
    search: Boolean(memory?.enabled),
  });
  const memoryTexts = await seedMemory(store, agent, task, memory, injectedIds);

  const messages: ApiMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt({
        instructions: agent.instructions,
        skillTexts: agent.skillTexts,
        memoryTexts,
      }) + (opts.activityContext ? '\n\n' + WORKFLOW_RESULT_INSTRUCTIONS + '\nContrato de campos requeridos: ' + JSON.stringify(opts.workflowContract ?? {}) : ''),
    },
    { role: 'user', content: await userContent(task, opts.attachments) },
  ];
  const effModel = agent.model ?? opts.model;
  const preset = analysisPreset({
    store,
    agentKey: agent.key,
    model: effModel,
    messages,
    maxSteps: opts.maxSteps,
    onEvent: opts.onEvent,
    activityContext: opts.activityContext,
    sinks: opts.observers,
  });

  return runStatelessTurn({
    store,
    llm: opts.modelProvider ?? defaultModelProvider,
    toolRt,
    overrides,
    agent,
    bus: preset.bus,
    workflow: opts.activityContext ? { contract: opts.workflowContract } : undefined,
    messages,
    tools,
    model: effModel,
    maxTokens: agent.maxTokens ?? opts.maxTokens,
    reasoningEffort: agent.reasoningEffort ?? opts.reasoningEffort,
    maxSteps: preset.maxSteps,
    memory,
    nativeCtx: opts.nativeCtx,
    injectedIds,
    // Los workflows respetan el perfil configurado; el análisis proactivo conserva
    // su superficie completa para preparar propuestas.
    capability: { allow: allowedTools },
    hooks: opts.hooks ?? NO_HOOKS,
    refusal:
      'No ejecutado (modo análisis headless): esta acción requiere confirmación humana. Proponela en un bloque <proposal> en vez de ejecutarla.',
    blocked: (name) => isNativeToolBlockedInAnalysis(name, opts.nativeToolsPolicy),
    // En un workflow el subagente cierra con su oración + el bloque <result> que le
    // pide su tarea; el <proposal> es SÓLO del análisis proactivo (si se colara en
    // un workflow, ensuciaría el chat con JSON crudo).
    closing: opts.activityContext
      ? WORKFLOW_RESULT_INSTRUCTIONS
      : 'Cerrá ahora: con lo que ya juntaste, devolvé las propuestas en bloques <proposal>…</proposal> sin más tool calls.',
  });
}

/**
 * Corre el agente de atención por WhatsApp (bot de cara al cliente). A diferencia
 * del análisis headless, respeta el ALLOW-LIST del agente (no abre toda la
 * superficie de tools) y NUNCA ejecuta escrituras: sólo las tools en modo `auto`.
 */
export async function runWhatsappTurn(opts: {
  store: AiStore;
  agentKey: string;
  message: string;
  context?: string;
  /** Turnos previos de la conversación (más antiguos primero). */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  nativeCtx?: NativeToolContext;
  model?: string;
  maxSteps?: number;
  /** Config de memoria del turno: habilita el RAG de FAQ/knowledge. */
  memory?: MemoryRuntimeOptions;
  /** Seam del modelo. Default: OpenRouter. Los tests inyectan un doble con guion. */
  modelProvider?: ModelProvider;
  /** Seam de tools (descubrimiento + ejecución). Default: el registry real. */
  toolRuntime?: ToolRuntime;
  /** Interceptores del loop. Sin ellos el comportamiento es exactamente el de hoy. */
  hooks?: AgentHooks;
  /** Observadores del stream de eventos. No alteran el turno. */
  observers?: RunEventSink[];
}): Promise<string> {
  const { store, agentKey, message, context, history, memory } = opts;
  const toolRt = opts.toolRuntime ?? defaultToolRuntime;
  const overrides = await loadOverrides(store);
  const agent = await resolveAgentByKey(store, agentKey);
  const injectedIds = new Set<string>();

  const tools = await buildToolsForModel(store, toolRt, overrides, agent.allowedTools, [], {
    search: Boolean(memory?.enabled),
  });
  const memoryTexts = await seedMemory(store, agent, message, memory, injectedIds);

  const messages: ApiMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt({
        instructions: agent.instructions,
        skillTexts: agent.skillTexts,
        memoryTexts,
        // El bot gobierna su formato con su propio prompt (texto plano de chat,
        // botones/listas nativas). El CORE_PROMPT del analista de backoffice
        // (visuales <sales_ui>, <ask_options>) lo contradice, así que se omite.
        skipCorePrompt: true,
      }),
    },
  ];
  if (context) {
    messages.push({
      role: 'system',
      content: `Datos verificados del cliente y sus pedidos (respondé SOLO con esto, no inventes; si el dato no está, decilo):\n${context}`,
    });
  }
  for (const h of history ?? []) messages.push({ role: h.role, content: h.content });
  messages.push({ role: 'user', content: message });

  const effModel = agent.model ?? opts.model;
  const preset = whatsappPreset({
    store,
    agentKey: agent.key,
    model: effModel,
    messages,
    maxSteps: opts.maxSteps,
    sinks: opts.observers,
  });

  return runStatelessTurn({
    store,
    llm: opts.modelProvider ?? defaultModelProvider,
    toolRt,
    overrides,
    agent,
    bus: preset.bus,
    messages,
    tools,
    model: effModel,
    maxTokens: agent.maxTokens,
    reasoningEffort: agent.reasoningEffort,
    maxSteps: preset.maxSteps,
    memory,
    nativeCtx: opts.nativeCtx,
    injectedIds,
    // Coherente con lo que se le pasó a `buildToolsForModel`.
    capability: { allow: agent.allowedTools },
    hooks: opts.hooks ?? NO_HOOKS,
    refusal:
      'No ejecutado: el bot de atención solo puede leer datos, no ejecutar esta acción. Explicáselo al cliente o sugerí hablar con una persona.',
    closing:
      'Respondé ahora al cliente con lo que tengas, en tono cordial y breve, sin usar más herramientas.',
  });
}
