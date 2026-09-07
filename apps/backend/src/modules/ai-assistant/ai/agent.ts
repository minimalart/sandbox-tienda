import { defaultModelProvider, type ChatRequest, type ModelProvider } from './chat-client';
import { defaultToolRuntime, type ToolRuntime } from './tool-registry';
import {
  actionFromArgs,
  classifyAction,
  defaultMode,
  resolveMode,
  resourceFromArgs,
  SEARCH_MEMORY_TOOL,
  REMEMBER_TOOL,
  type PolicyOverride,
} from './policy';
import { embedText, retrieveMemories, touchMemories, type RankedMemory } from './memory';
import { resourceLabel, toolDescription, toolLabel } from './tool-labels';
import { resolveActiveAgent, type ResolvedAgent } from './agents';
import { modeFromProfile, resolveCapabilityProfile } from './capabilities';
import { chatPreset } from './presets';
import { buildSystemPrompt, type AgentIdentity } from './prompt';
import { NO_HOOKS, type AgentHooks, type HookAgent } from './hooks';
import { buildCorrectionInstruction, judgeGrounding } from './validation';
import { RunTracer, type RunStatus } from './tracing';
import type { ClassifiedToolCall, RunEventSink } from './run-events';
import {
  buildToolsForModel,
  effectiveMemoryTypes,
  execTool,
  HANDOFF_TOOL_NAME,
  loadOverrides,
  runRememberTool,
  runSearchMemoryTool,
  safeParseArgs,
  toolActions,
  toolResources,
  userContent,
} from './runtime';
import { listCanonicalWorkflowDefinitions } from './workflows/recipe';
import type {
  AgentEvent,
  AgentResult,
  AiStore,
  ApiMessage,
  ChatAttachment,
  MemoryRuntimeOptions,
  PendingToolCall,
  ProposedAction,
  TimelineItem,
  ToolCall,
  ToolMatrixEntry,
} from './types';
import type { NativeToolContext } from './native-tools';
import { extractActionResult, resolvePipedArgs } from './proposals';

// El contrato de persistencia (`AiStore`), los tipos de la vista del admin y las
// opciones de memoria se mudaron a `./types` (y `memoryOptionsFromConfig` a
// `./memory`) para romper los ciclos de import con `native-tools`, `campaign`,
// `proposals` y `workflow-engine`. Se re-exportan acá para no tocar a los
// consumidores externos, que siguen importándolos de `./agent`.
export type {
  AiStore,
  ChatOverrides,
  ClientActivity,
  ClientHandoff,
  ClientMessage,
  MemoryConfigInput,
  MemoryRuntimeOptions,
  ProposedAction,
  TimelineItem,
  ToolMatrixEntry,
} from './types';
export { memoryOptionsFromConfig } from './memory';
// `runHeadlessAnalysis` se mudó a `./headless` para romper el último ciclo de
// imports; se re-exporta para no tocar a sus consumidores.
export { runHeadlessAnalysis, runWhatsappTurn } from './headless';
export { userContent } from './runtime';

type StoredRow = {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls: ToolCall[] | null;
  tool_call_id: string | null;
  status: 'complete' | 'pending' | null;
  agent_key?: string | null;
  attachments?: ChatAttachment[] | null;
  created_at?: string | Date;
};


/** Host legible de una URL (sin www.), para etiquetar fuentes en la Cadena de pensamiento. */
/** Reconstruye el historial en formato API desde las filas persistidas. */
async function buildApiMessages(rows: StoredRow[]): Promise<ApiMessage[]> {
  // Las filas `system` (legado: el system prompt se persistía al crear el hilo)
  // se ignoran: ahora el system prompt se compone en runtime por agente activo y
  // se antepone en `runLoop`, así un handoff cambia el prompt sin tocar el historial.
  const out: ApiMessage[] = [];
  for (const row of rows.filter((r) => r.role !== 'system')) {
    if (row.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: row.content ?? '',
        ...(row.tool_calls && row.tool_calls.length > 0 ? { tool_calls: row.tool_calls } : {}),
      });
    } else if (row.role === 'tool') {
      out.push({
        role: 'tool',
        content: row.content ?? '',
        tool_call_id: row.tool_call_id ?? undefined,
      });
    } else if (row.role === 'user') {
      out.push({ role: 'user', content: await userContent(row.content, row.attachments) });
    } else {
      out.push({ role: row.role, content: row.content ?? '' });
    }
  }
  return out;
}

/**
 * Ejecuta un handoff: valida que el destino esté declarado por el agente actual,
 * lo resuelve por `key` → id y setea `active_agent_id` del hilo. Devuelve el texto
 * del tool result. No toca el MCP: el cambio de agente lo aplica el loop en la
 * vuelta siguiente al re-resolver el agente activo.
 */
async function doHandoff(
  store: AiStore,
  threadId: string,
  agent: ResolvedAgent,
  args: Record<string, unknown>,
): Promise<string> {
  const target = typeof args.target === 'string' ? args.target.trim() : '';
  if (!target || !agent.handoffTargets.includes(target)) {
    return `No se pudo derivar: "${target}" no es un destino válido para ${agent.key}. Destinos disponibles: ${
      agent.handoffTargets.join(', ') || '(ninguno)'
    }.`;
  }
  let targetRow: { id: string; name?: string } | null = null;
  try {
    const rows = await store.listAgents({ key: target, enabled: true }, { take: 1 });
    targetRow = rows[0] ?? null;
  } catch {
    targetRow = null;
  }
  if (!targetRow) {
    return `No se pudo derivar: el agente "${target}" no existe o está deshabilitado.`;
  }
  await store.updateChatThreads({ id: threadId, active_agent_id: targetRow.id });
  const reason =
    typeof args.reason === 'string' && args.reason.trim()
      ? ` Contexto para el agente destino: ${args.reason.trim()}`
      : '';
  return `Conversación derivada a "${targetRow.name ?? target}".${reason}`;
}

async function loadRows(store: AiStore, threadId: string): Promise<StoredRow[]> {
  return (await store.listChatMessages(
    { thread_id: threadId },
    { order: { created_at: 'ASC' }, take: 1000 },
  )) as StoredRow[];
}

/**
 * Resuelve nombre+rol de los compañeros (los `handoff_targets` del agente activo)
 * para el bloque de estilo de equipo del prompt. Best-effort: ante cualquier
 * error devuelve [] (el prompt sigue funcionando sin la lista de colegas).
 */
async function resolveTeammates(
  store: AiStore,
  keys: string[],
): Promise<AgentIdentity[]> {
  if (!keys.length) return [];
  try {
    const rows = await store.listAgents({ key: keys, enabled: true }, { take: 50 });
    return rows.map((r) => ({
      name: String(r.name ?? ''),
      role: r.description ? String(r.description) : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Corre el loop agéntico hasta cerrar el turno o frenar por una acción que
 * requiere confirmación. Asume que las filas persistidas están en un estado
 * consistente para llamar al modelo (último mensaje = user, o tool results
 * completos). Lo invocan tanto `runUserTurn` como `confirmTools`.
 */

async function runLoop(opts: {
  store: AiStore;
  threadId: string;
  model?: string;
  maxTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  /** Si está presente, el loop corre en streaming y emite eventos en vivo. */
  onEvent?: (ev: AgentEvent) => void;
  /** Valida el grounding de la respuesta final y, si falla, corrige una vez. */
  validationEnabled?: boolean;
  /** Container para las tools nativas (image/blog); lo arman las rutas. */
  nativeCtx?: NativeToolContext;
  /** Config de memoria del turno (recuperación + tools). Off = comportamiento previo. */
  memory?: MemoryRuntimeOptions;
  /** Seam del modelo. Default: OpenRouter. Los tests inyectan un doble con guion. */
  modelProvider?: ModelProvider;
  /** Seam de tools (descubrimiento + ejecución). Default: el registry real. */
  toolRuntime?: ToolRuntime;
  /** Interceptores del loop. Sin ellos el comportamiento es exactamente el de hoy. */
  hooks?: AgentHooks;
  /** Observadores del stream de eventos. No alteran el turno. */
  observers?: RunEventSink[];
}): Promise<AgentResult> {
  const { store, threadId, model, maxTokens, reasoningEffort, onEvent, validationEnabled, nativeCtx, memory } =
    opts;
  const llm = opts.modelProvider ?? defaultModelProvider;
  const toolRt = opts.toolRuntime ?? defaultToolRuntime;
  const hooks = opts.hooks ?? NO_HOOKS;
  const overrides = await loadOverrides(store);

  // ── Memoria del turno (best-effort, gated por config) ──
  const memoryEnabled = Boolean(memory?.enabled);
  const memTenant = memory?.tenantId ?? 'default';
  const injectedIds = new Set<string>();
  const memoryByAgent = new Map<string, RankedMemory[]>();
  // Embebemos el último mensaje del usuario UNA vez por turno (no por step).
  let turnQueryEmbedding: number[] | null = null;
  if (memoryEnabled) {
    try {
      const preRows = await loadRows(store, threadId);
      const lastUser = [...preRows].reverse().find((r) => r.role === 'user');
      const q = (lastUser?.content ?? '').trim();
      if (q) turnQueryEmbedding = await embedText(q);
    } catch {
      turnQueryEmbedding = null;
    }
  }
  // Un solo escritor: el loop emite HECHOS y cada destino los proyecta a su
  // formato. Qué destinos tiene esta corrida lo decide el preset.
  const { bus, maxSteps } = chatPreset({ store, threadId, model, onEvent, sinks: opts.observers });
  let finalStatus: RunStatus = 'complete';
  let errorMsg: string | undefined;
  // La corrección por grounding se hace como mucho UNA vez por turno (costo/latencia).
  let correctedOnce = false;
  // Último agente activo: para atribuir el mensaje de corte por máximo de pasos,
  // que se persiste fuera del for (donde `agent` ya no está en scope).
  let lastAgentKey: string | undefined;
  try {
  await bus.emit({ type: 'turn_started', at: Date.now(), maxSteps });
  for (let step = 0; step < maxSteps; step++) {
    // El agente activo se resuelve en CADA vuelta: un handoff actualiza el
    // `active_agent_id` del hilo y el paso siguiente ya corre con el agente
    // destino (su prompt, sus tools y su modelo). `discoverTools` está cacheado,
    // así que re-resolver por paso es barato.
    const agent = await resolveActiveAgent(store, threadId);
    lastAgentKey = agent.key;
    const tools = await buildToolsForModel(
      store,
      toolRt,
      overrides,
      agent.allowedTools,
      agent.handoffTargets,
      {
        search: memoryEnabled,
        remember: memoryEnabled && Boolean(memory?.autocaptureEnabled),
      },
    );
    const hookAgent: HookAgent = { key: agent.key, model: agent.model, maxTokens: agent.maxTokens };
    const stepCtx = { run: bus.meta, step, maxSteps, agent: hookAgent };
    if (hooks.beforeStep) {
      const decision = await hooks.beforeStep(stepCtx);
      if (decision?.stop) {
        if (decision.message) {
          await bus.emit({
            type: 'assistant_message',
            at: Date.now(),
            agentKey: agent.key,
            content: decision.message,
            toolCalls: [],
            status: 'complete',
          });
        }
        finalStatus = 'complete';
        return { status: 'complete' };
      }
    }

    // Compañeros del agente activo (sus destinos de handoff) para el estilo de equipo.
    const teammates = await resolveTeammates(store, agent.handoffTargets);

    // Recuperación de memoria para el agente activo (cacheada por agente en el turno:
    // un handoff la recalcula, los pasos del mismo agente la reusan).
    let memoryTexts: string[] = [];
    if (memoryEnabled && turnQueryEmbedding) {
      let mems = memoryByAgent.get(agent.key);
      if (!mems) {
        mems = await retrieveMemories(store, {
          tenantId: memTenant,
          agentKey: agent.key,
          memoryTypes: effectiveMemoryTypes(agent.memoryTypes),
          queryEmbedding: turnQueryEmbedding,
          topK: memory?.topK ?? 5,
          minSimilarity: memory?.minSimilarity,
        });
        memoryByAgent.set(agent.key, mems);
      }
      memoryTexts = mems.map((m) => m.text);
      for (const m of mems) injectedIds.add(m.id);
    }

    let systemPrompt = buildSystemPrompt({
      instructions: agent.instructions,
      skillTexts: agent.skillTexts,
      self: { name: agent.name, role: agent.description },
      teammates,
      memoryTexts,
    });
    // Si el agente puede arrancar workflows (tiene la tool start_workflow o ve todas),
    // listale los HABILITADOS para que conozca los definidos desde la UI sin que estén
    // hardcodeados en sus instrucciones. Así el Orquestador sabe qué puede arrancar.
    const canStartWorkflows =
      agent.allowedTools == null || agent.allowedTools.some((t) => t.tool === 'start_workflow');
    if (canStartWorkflows) {
      // `listWorkflowDefinitions` es un método autogenerado por MedusaService y no
      // está en `AiStore`. El `.catch()` encadenado NO alcanzaba como guarda: si el
      // método no existe, la llamada tira un TypeError sincrónico y nunca hay promesa
      // que atrapar. Se comprueba antes de invocar.
      const listWorkflows = (
        store as { listWorkflowDefinitions?: (f: unknown, c: unknown) => Promise<unknown[]> }
      ).listWorkflowDefinitions;
      const wfs =
        typeof listWorkflows === 'function'
          ? await listWorkflows.call(store, { enabled: true }, { take: 50 }).catch(() => [] as unknown[])
          : [];
      const workflowByKey = new Map<string, { key: string; name: string; description?: string | null }>();
      for (const w of listCanonicalWorkflowDefinitions()) {
        workflowByKey.set(w.key, { key: w.key, name: w.name, description: w.description });
      }
      if (Array.isArray(wfs)) {
        for (const w of wfs as Array<{ key: string; name: string; description?: string | null }>) {
          if (w?.key) workflowByKey.set(w.key, w);
        }
      }
      const availableWorkflows = [...workflowByKey.values()];
      if (availableWorkflows.length > 0) {
        systemPrompt +=
          '\n\nWORKFLOWS DISPONIBLES (arrancalos con la tool `start_workflow` pasando su `key`; el motor coordina al equipo y vuelve con el resultado):\n' +
          availableWorkflows
            .map(
              (w: { key: string; name: string; description?: string | null }) =>
                `- key "${w.key}": ${w.name}${w.description ? ` — ${w.description}` : ''}`,
            )
            .join('\n') +
          '\nCuando el pedido del usuario coincida con uno de estos workflows (p. ej. crear una receta), arrancalo con start_workflow en vez de derivar o de decir que "no hay workflow". Pasá el input que corresponda (p. ej. { "topic": "…" }).';
      }
    }
    // El agente puede fijar su propio modelo/presupuesto; si no, usa lo que mandó
    // la route (override de la UI o el default de store-config).
    const effModel = agent.model ?? model;
    const effMaxTokens = agent.maxTokens ?? maxTokens;
    const effReasoningEffort = agent.reasoningEffort ?? reasoningEffort;

    const rows = await loadRows(store, threadId);

    // Defensa: si el último assistant quedó pending (esperando aprobación), no
    // llamamos al modelo; devolvemos los pendientes reconstruidos.
    const last = rows[rows.length - 1];
    if (last?.role === 'assistant' && last.status === 'pending' && last.tool_calls?.length) {
      finalStatus = 'needs_approval';
      return { status: 'needs_approval', pending: pendingFromToolCalls(last.tool_calls, overrides) };
    }

    const messages: ApiMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(await buildApiMessages(rows)),
    ];
    await bus.emit({ type: 'step_started', at: Date.now(), idx: step, agentKey: agent.key });
    let request: ChatRequest = {
      model: effModel,
      messages,
      tools,
      maxTokens: effMaxTokens,
      reasoningEffort: effReasoningEffort,
    };
    if (hooks.beforeModelRequest) {
      const patch = await hooks.beforeModelRequest({ ...stepCtx, purpose: 'step', request });
      if (patch) request = patch.request;
    }
    const modelStart = Date.now();
    // En streaming usamos `model.stream` (emite tokens en vivo); sin `onEvent`
    // el path queda idéntico al sincrónico de siempre. Ambos devuelven el mismo
    // `ChatCompletionMessage`, así que el resto del loop no cambia.
    const assistant = onEvent
      ? await llm.stream(
          request,
          (t) => bus.emitSync({ type: 'assistant_chunk', at: Date.now(), channel: 'content', text: t }),
          (r) => bus.emitSync({ type: 'assistant_chunk', at: Date.now(), channel: 'reasoning', text: r }),
        )
      : await llm.complete(request);
    await bus.emit({
      type: 'model_completed',
      at: Date.now(),
      idx: step,
      agentKey: agent.key,
      model: effModel,
      purpose: 'step',
      durationMs: Date.now() - modelStart,
      promptTokens: assistant.usage?.prompt_tokens,
      completionTokens: assistant.usage?.completion_tokens,
      finishReason: assistant.finish_reason,
    });

    if (!assistant.tool_calls || assistant.tool_calls.length === 0) {
      // Si el modelo no devolvió texto (ni tool calls), no dejamos el turno en
      // blanco: persistimos un mensaje visible para que la UI no muestre vacío.
      // Distinguimos el corte por límite de tokens (`length`) del "no supe qué
      // responder": con `length` el problema es presupuesto, no la consulta.
      const truncated = assistant.finish_reason === 'length';
      const hasRealContent = Boolean(assistant.content?.trim());
      let content = hasRealContent
        ? (assistant.content as string)
        : truncated
          ? 'La respuesta se cortó por longitud antes de poder mostrarla. Probá una pregunta más específica o subí CHAT_AI_MAX_TOKENS.'
          : 'No pude generar una respuesta para esta consulta. Probá reformularla o acotá el período.';

      // Validación de grounding (anti-alucinación), si está activa y hay respuesta
      // real. Si el juez la marca no-grounded, pedimos UNA corrección usando solo
      // los datos ya juntados (sin tools nuevas) y persistimos SOLO la corregida.
      if (validationEnabled && hasRealContent) {
        const verdict = await judgeGrounding({ messages, answer: content, model: effModel });
        if (verdict) await bus.emit({ type: 'grounding_judged', at: Date.now(), verdict });
        if (verdict && !verdict.grounded && !correctedOnce) {
          correctedOnce = true;
          await bus.emit({ type: 'step_started', at: Date.now(), idx: step, agentKey: agent.key });
          const correctionMessages: ApiMessage[] = [
            ...messages,
            { role: 'assistant', content },
            { role: 'user', content: buildCorrectionInstruction(verdict.issues) },
          ];
          let correctionRequest: ChatRequest = {
            model: effModel,
            messages: correctionMessages,
            maxTokens: effMaxTokens,
            reasoningEffort: effReasoningEffort,
          };
          if (hooks.beforeModelRequest) {
            const patch = await hooks.beforeModelRequest({
              ...stepCtx,
              purpose: 'correction',
              request: correctionRequest,
            });
            if (patch) correctionRequest = patch.request;
          }
          const correctionStart = Date.now();
          const corrected = onEvent
            ? await llm.stream(
                correctionRequest,
                (t) => bus.emitSync({ type: 'assistant_chunk', at: Date.now(), channel: 'content', text: t }),
                (r) => bus.emitSync({ type: 'assistant_chunk', at: Date.now(), channel: 'reasoning', text: r }),
              )
            : await llm.complete(correctionRequest);
          await bus.emit({
            type: 'model_completed',
            at: Date.now(),
            idx: step,
            agentKey: agent.key,
            model: effModel,
            purpose: 'correction',
            durationMs: Date.now() - correctionStart,
            promptTokens: corrected.usage?.prompt_tokens,
            completionTokens: corrected.usage?.completion_tokens,
            finishReason: corrected.finish_reason,
          });
          if (corrected.content?.trim()) content = corrected.content;
        }
      }

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
        type: 'assistant_message',
        at: Date.now(),
        agentKey: agent.key,
        content,
        toolCalls: [],
        status: 'complete',
      });
      await bus.emit({
        type: 'step_completed',
        at: Date.now(),
        idx: step,
        agentKey: agent.key,
        outcome: 'answered',
      });
      finalStatus = 'complete';
      return { status: 'complete' };
    }

    // El perfil del agente puede ANGOSTAR lo que la ToolPolicy global permite,
    // nunca ampliarlo: es el enforcement real del allow-list, que hasta acá era
    // sólo una sugerencia en el prompt.
    const profile = resolveCapabilityProfile(agent);
    const classified = assistant.tool_calls.map((tc) => {
      const args = safeParseArgs(tc.function.arguments);
      const action = actionFromArgs(args);
      const resource = resourceFromArgs(args);
      const byProfile =
        tc.function.name === HANDOFF_TOOL_NAME
          ? null
          : modeFromProfile(profile, tc.function.name, action, resource || null);
      return {
        tc,
        args,
        action,
        resource,
        mode: byProfile ?? resolveMode(tc.function.name, action, resource, overrides),
      };
    });
    /** Vista del tool call que viaja en los eventos del stream. */
    const asCall = (c: (typeof classified)[number]): ClassifiedToolCall => ({
      id: c.tc.id,
      name: c.tc.function.name,
      args: c.args,
      action: c.action,
      resource: c.resource,
      mode: c.mode,
    });

    // Handoff: si el agente decide derivar, tiene prioridad sobre todo lo demás.
    // Se ejecuta como `auto` (cambiar de agente no es una mutación sensible) y el
    // resto de tool calls de ese turno se marcan como no ejecutadas. La próxima
    // vuelta re-resuelve al agente destino.
    const hasHandoff = classified.some((c) => c.tc.function.name === HANDOFF_TOOL_NAME);
    if (hasHandoff) {
      await bus.emit({
        type: 'assistant_message',
        at: Date.now(),
        agentKey: agent.key,
        content: assistant.content ?? '',
        toolCalls: assistant.tool_calls,
        status: 'complete',
      });
      for (const c of classified) {
        if (c.tc.function.name === HANDOFF_TOOL_NAME) {
          const text = await doHandoff(store, threadId, agent, c.args);
          await bus.emit({
            type: 'agent_handoff',
            at: Date.now(),
            from: agent.key,
            target: String(c.args?.target ?? ''),
            reason: typeof c.args?.reason === 'string' ? c.args.reason : undefined,
            callId: c.tc.id,
            ok: !text.startsWith('No se pudo derivar'),
            text,
          });
        } else {
          await bus.emit({
            type: 'tool_rejected',
            at: Date.now(),
            agentKey: agent.key,
            call: asCall(c),
            by: 'handoff',
            text: 'No ejecutado: el agente derivó la conversación a otro agente.',
          });
        }
      }
      await bus.emit({
        type: 'step_completed',
        at: Date.now(),
        idx: step,
        agentKey: agent.key,
        outcome: 'handoff',
      });
      continue;
    }

    const needsApproval = classified.some((c) => c.mode === 'ask');

    if (needsApproval) {
      // Persistimos el turno del assistant como pendiente; NO ejecutamos nada.
      const pending = pendingFromToolCalls(assistant.tool_calls, overrides);
      if (hooks.beforeTurnStop) {
        const decision = await hooks.beforeTurnStop({
          run: bus.meta,
          reason: 'needs_approval',
          steps: step + 1,
          agent: hookAgent,
          draft: { status: 'needs_approval', pending },
        });
        if (decision?.continue) continue;
      }
      await bus.emit({
        type: 'assistant_message',
        at: Date.now(),
        agentKey: agent.key,
        content: assistant.content ?? '',
        toolCalls: assistant.tool_calls,
        status: 'pending',
      });
      await bus.emit({
        type: 'tool_suspended',
        at: Date.now(),
        agentKey: agent.key,
        pending,
      });
      await bus.emit({
        type: 'step_completed',
        at: Date.now(),
        idx: step,
        agentKey: agent.key,
        outcome: 'suspended',
      });
      finalStatus = 'needs_approval';
      return { status: 'needs_approval', pending };
    }

    // Todas auto/prohibidas → ejecutamos y seguimos el loop.
    await bus.emit({
      type: 'assistant_message',
      at: Date.now(),
      agentKey: agent.key,
      content: assistant.content ?? '',
      toolCalls: assistant.tool_calls,
      status: 'complete',
    });
    for (const c of classified) {
      const toolName = c.tc.function.name;
      await bus.emit({
        type: 'tool_called',
        at: Date.now(),
        agentKey: agent.key,
        call: asCall(c),
      });
      const toolStart = Date.now();
      const toolCtx = {
        ...stepCtx,
        call: asCall(c),
        synthetic:
          toolName === SEARCH_MEMORY_TOOL
            ? ('search_memory' as const)
            : toolName === REMEMBER_TOOL
              ? ('remember' as const)
              : null,
      };
      let hookSkip: { skip: true; result: string } | null = null;
      if (hooks.beforeToolExecute) {
        const decision = await hooks.beforeToolExecute(toolCtx);
        if (decision && 'skip' in decision) hookSkip = decision;
        else if (decision && 'args' in decision) c.args = decision.args;
      }
      let text: string;
      if (hookSkip) {
        text = hookSkip.result;
      } else if (toolName === SEARCH_MEMORY_TOOL) {
        const r = await runSearchMemoryTool(store, c.args, {
          tenantId: memTenant,
          agentKey: agent.key,
          memoryTypes: effectiveMemoryTypes(agent.memoryTypes),
          minSimilarity: memory?.minSimilarity ?? 0.35,
        });
        text = r.text;
        for (const id of r.ids) injectedIds.add(id);
      } else if (toolName === REMEMBER_TOOL) {
        const r = await runRememberTool(store, c.args, {
          tenantId: memTenant,
          agentKey: agent.key,
          threadId,
          requiresApproval: Boolean(memory?.autocaptureRequiresApproval),
          createdBy: memory?.createdBy ?? null,
        });
        text = r.text;
      } else if (c.mode === 'prohibited') {
        text = 'Acción prohibida por la configuración del asistente. No se ejecutó.';
      } else {
        text = await execTool(store, toolRt, toolName, c.args, nativeCtx);
      }
      let ok = c.mode !== 'prohibited' && !text.startsWith('Error');
      if (hooks.afterToolExecute) {
        const patch = await hooks.afterToolExecute({
          ...toolCtx,
          result: text,
          ok,
          durationMs: Date.now() - toolStart,
        });
        if (patch) {
          text = patch.result;
          ok = c.mode !== 'prohibited' && !text.startsWith('Error');
        }
      }
      if (c.mode === 'prohibited') {
        await bus.emit({
          type: 'tool_rejected',
          at: Date.now(),
          agentKey: agent.key,
          call: asCall(c),
          by: 'policy',
          text,
        });
      } else {
        await bus.emit({
          type: 'tool_completed',
          at: Date.now(),
          agentKey: agent.key,
          call: asCall(c),
          text,
          ok,
          durationMs: Date.now() - toolStart,
        });
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
    // `continue` se ignora en esta salida: extender el turno derrotaría el tope
    // de pasos, que es la única defensa contra un loop que no converge.
    await hooks.beforeTurnStop({
      run: bus.meta,
      reason: 'max_steps',
      steps: maxSteps,
      agent: { key: lastAgentKey ?? '' },
      draft: { status: 'complete' },
    });
  }
  await bus.emit({
    type: 'assistant_message',
    at: Date.now(),
    agentKey: lastAgentKey,
    content:
      'Alcancé el máximo de pasos para esta consulta. Reformulá la pregunta o acotá el período para que pueda responder.',
    toolCalls: [],
    status: 'complete',
  });
  finalStatus = 'complete';
  return { status: 'complete' };
  } catch (e) {
    finalStatus = 'error';
    errorMsg = (e as Error).message;
    throw e;
  } finally {
    // Auditoría: qué memorias influyeron. El sink de traza las acumula desde
    // los `memory_retrieved` y las persiste al cerrar el run; acá sólo queda
    // marcarles el uso, que es escritura de dominio y no de observabilidad.
    if (injectedIds.size > 0) {
      await bus.emit({ type: 'memory_retrieved', at: Date.now(), agentKey: lastAgentKey ?? '', ids: [...injectedIds] });
      await touchMemories(store, [...injectedIds]);
    }
    await bus.emit({ type: 'turn_completed', at: Date.now(), status: finalStatus, error: errorMsg });
  }
}

function pendingFromToolCalls(
  toolCalls: ToolCall[],
  overrides: PolicyOverride[],
): PendingToolCall[] {
  return toolCalls
    .map((tc) => {
      const args = safeParseArgs(tc.function.arguments);
      const action = actionFromArgs(args);
      const resource = resourceFromArgs(args);
      return {
        tool_call_id: tc.id,
        name: tc.function.name,
        action,
        args,
        kind: classifyAction(action),
        mode: resolveMode(tc.function.name, action, resource, overrides),
      };
    })
    .filter((c) => c.mode === 'ask')
    .map(({ mode: _mode, ...rest }) => rest);
}


/**
 * Matriz de capacidades para la pantalla de Configuración: cada tool con sus
 * acciones, su clasificación read/write, el modo efectivo (override||default) y
 * el default. Lo consume `GET /admin/ai-assistant/tools`.
 */
export async function getToolMatrix(
  store: AiStore,
  overrides: PolicyOverride[],
): Promise<ToolMatrixEntry[]> {
  const rawTools = await defaultToolRuntime.discover(store);
  return rawTools
    .filter((t) => t.definition?.name)
    .flatMap((t) => {
      const tool = t.definition.name;
      return toolResources(t.definition.parameters).map((resource) => {
        const actions = toolActions(t.definition.parameters).map((action) => ({
          action,
          kind: classifyAction(action),
          mode: resolveMode(tool, action, resource ?? '', overrides),
          default: defaultMode(tool, action, resource ?? ''),
        }));
        return {
          tool,
          resource: resource ?? undefined,
          label: resource
            ? `${toolLabel(tool)} · ${resourceLabel(resource)}`
            : toolLabel(tool),
          description: resource ? undefined : toolDescription(tool, t.definition.description),
          actions,
        };
      });
    });
}

/**
 * Vista del hilo para la UI: mensajes visibles (user/assistant con texto) y los
 * tool calls pendientes de aprobación (si el último assistant quedó `pending`).
 * Las filas `system` y `tool` no se muestran. Para un assistant `pending` sin
 * texto, no se emite un mensaje vacío (solo cuentan los pendientes).
 */
/** Verbo en español según la `action` del tool call (para la traza de actividad). */
const ACTIVITY_VERBS: Record<string, string> = {
  list: 'Consultó',
  get: 'Consultó',
  retrieve: 'Consultó',
  create: 'Creó',
  update: 'Actualizó',
  delete: 'Eliminó',
};

/** Etiqueta humana de una tool ejecutada: "Consultó Productos", "Creó Marcas", etc. */
function activityLabel(name: string, args: Record<string, unknown>): string {
  if (name === SEARCH_MEMORY_TOOL) return 'Buscó en la memoria';
  if (name === REMEMBER_TOOL) return 'Guardó en la memoria';
  const action = actionFromArgs(args);
  const resource = resourceFromArgs(args);
  const verb = ACTIVITY_VERBS[action] ?? 'Usó';
  // Si la tool tiene granularidad por `resource` (p. ej. extensiones), ese es el
  // sustantivo más informativo; si no, el label de la tool.
  const what = resource ? resourceLabel(resource) : toolLabel(name);
  return `${verb} ${what}`;
}

/** ¿El texto del tool result indica que NO se ejecutó/falló? */
function isFailureResult(text: string): boolean {
  return /^\s*(Error|Acción prohibida|No ejecutad|El usuario rechazó)/i.test(text);
}

export async function loadThreadView(
  store: AiStore,
  threadId: string,
): Promise<{ messages: TimelineItem[]; pending: PendingToolCall[] }> {
  const rows = await loadRows(store, threadId);
  const overrides = await loadOverrides(store);

  // Resultados de tools indexados por tool_call_id, para el ok/error de la actividad.
  const toolResultById = new Map<string, string>();
  for (const r of rows) {
    if (r.role === 'tool' && r.tool_call_id) toolResultById.set(r.tool_call_id, r.content ?? '');
  }

  // Recorremos en orden y vamos intercalando texto, actividad y derivaciones.
  const messages: TimelineItem[] = [];
  for (const r of rows) {
    if (r.role === 'user') {
      const content = (r.content ?? '').trim();
      const attachments = Array.isArray(r.attachments) ? r.attachments : null;
      if (content || (attachments && attachments.length > 0)) {
        messages.push({
          kind: 'message',
          id: r.id,
          role: 'user',
          content,
          status: r.status ?? null,
          attachments: attachments ?? undefined,
          created_at: r.created_at,
        });
      }
      continue;
    }
    if (r.role !== 'assistant') continue; // `system`/`tool` no se emiten directo

    const text = (r.content ?? '').trim();
    if (text) {
      messages.push({
        kind: 'message',
        id: r.id,
        role: 'assistant',
        content: text,
        status: r.status ?? null,
        agent_key: r.agent_key ?? null,
        created_at: r.created_at,
      });
    }

    // Las tool_calls de un assistant `pending` están esperando aprobación: se
    // muestran vía `pending` (no como actividad ya hecha). El resto se traza.
    if (r.status === 'pending') continue;
    for (const tc of Array.isArray(r.tool_calls) ? r.tool_calls : []) {
      const args = safeParseArgs(tc.function.arguments);
      if (tc.function.name === HANDOFF_TOOL_NAME) {
        messages.push({
          kind: 'handoff',
          id: `${r.id}:${tc.id}`,
          from: r.agent_key ?? null,
          target: String(args.target ?? ''),
          reason: typeof args.reason === 'string' && args.reason.trim() ? args.reason.trim() : undefined,
        });
        continue;
      }
      const result = tc.id ? toolResultById.get(tc.id) ?? '' : '';
      messages.push({
        kind: 'activity',
        id: `${r.id}:${tc.id}`,
        agent_key: r.agent_key ?? null,
        label: activityLabel(tc.function.name, args),
        ok: !isFailureResult(result),
      });
    }
  }

  const last = rows[rows.length - 1];
  const pending =
    last?.role === 'assistant' && last.status === 'pending' && last.tool_calls?.length
      ? pendingFromToolCalls(last.tool_calls, overrides)
      : [];

  return { messages, pending };
}

/** Punto de entrada cuando llega un mensaje nuevo del usuario. */
export async function runUserTurn(opts: {
  store: AiStore;
  threadId: string;
  model?: string;
  maxTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  /** Si está presente, el turno corre en streaming (route SSE). */
  onEvent?: (ev: AgentEvent) => void;
  /** Valida el grounding de la respuesta final y, si falla, corrige una vez. */
  validationEnabled?: boolean;
  /** Container para las tools nativas (image/blog). */
  nativeCtx?: NativeToolContext;
  /** Config de memoria del turno. */
  memory?: MemoryRuntimeOptions;
  /** Seam del modelo. Default: OpenRouter. Los tests inyectan un doble con guion. */
  modelProvider?: ModelProvider;
  /** Seam de tools (descubrimiento + ejecución). Default: el registry real. */
  toolRuntime?: ToolRuntime;
  /** Interceptores del loop. Sin ellos el comportamiento es exactamente el de hoy. */
  hooks?: AgentHooks;
  /** Observadores del stream de eventos. No alteran el turno. */
  observers?: RunEventSink[];
}): Promise<AgentResult> {
  return runLoop(opts);
}

/**
 * Resuelve los tool calls pendientes con las decisiones del usuario y reanuda.
 * Para el último assistant `pending`: auto→ejecuta, ask→según decisión,
 * prohibited→rechaza; persiste los tool results, marca el assistant `complete`
 * y vuelve a correr el loop.
 */
export async function confirmTools(opts: {
  store: AiStore;
  threadId: string;
  decisions: Array<{ tool_call_id: string; approved: boolean }>;
  model?: string;
  maxTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  /** Container para las tools nativas (image/blog). */
  nativeCtx?: NativeToolContext;
  /** Config de memoria del turno. */
  memory?: MemoryRuntimeOptions;
  /** Seam del modelo. Default: OpenRouter. Los tests inyectan un doble con guion. */
  modelProvider?: ModelProvider;
  /** Seam de tools (descubrimiento + ejecución). Default: el registry real. */
  toolRuntime?: ToolRuntime;
  /** Interceptores del loop. Sin ellos el comportamiento es exactamente el de hoy. */
  hooks?: AgentHooks;
  /** Observadores del stream de eventos. No alteran el turno. */
  observers?: RunEventSink[];
}): Promise<AgentResult> {
  const { store, threadId, decisions, model, maxTokens, reasoningEffort, nativeCtx, memory } = opts;
  const toolRt = opts.toolRuntime ?? defaultToolRuntime;
  const overrides = await loadOverrides(store);

  const rows = await loadRows(store, threadId);
  const pendingAssistant = [...rows]
    .reverse()
    .find((r) => r.role === 'assistant' && r.status === 'pending' && r.tool_calls?.length);

  if (!pendingAssistant || !pendingAssistant.tool_calls) {
    return { status: 'error', message: 'No hay tool calls pendientes de confirmación.' };
  }

  const decisionMap = new Map(decisions.map((d) => [d.tool_call_id, d.approved]));

  for (const tc of pendingAssistant.tool_calls) {
    const args = safeParseArgs(tc.function.arguments);
    const action = actionFromArgs(args);
    const resource = resourceFromArgs(args);
    const mode = resolveMode(tc.function.name, action, resource, overrides);

    let text: string;
    if (mode === 'prohibited') {
      text = 'Acción prohibida por la configuración del asistente. No se ejecutó.';
    } else if (mode === 'ask') {
      text = decisionMap.get(tc.id)
        ? await execTool(store, toolRt, tc.function.name, args, nativeCtx)
        : 'El usuario rechazó ejecutar esta acción. No se ejecutó.';
    } else {
      text = await execTool(store, toolRt, tc.function.name, args, nativeCtx);
    }

    await store.createChatMessages({
      thread_id: threadId,
      role: 'tool',
      tool_call_id: tc.id,
      content: text,
    });
  }

  await store.updateChatMessages({ id: pendingAssistant.id, status: 'complete' });

  return runLoop({ store, threadId, model, maxTokens, reasoningEffort, nativeCtx, memory, modelProvider: opts.modelProvider, toolRuntime: opts.toolRuntime, hooks: opts.hooks, observers: opts.observers });
}


/**
 * Ejecuta las acciones de una Propuesta aprobada por el mismo `execTool` gateado
 * por políticas que el chat. La aprobación humana ES el consentimiento (no se
 * vuelve a pedir confirmación por acción), pero las acciones `prohibited` NUNCA
 * se ejecutan. Una propuesta sin acciones (asesora) se considera `executed`.
 * Las acciones corren EN SERIE con piping: una acción puede referenciar el
 * resultado de la anterior con "$prev.<path>" (p. ej. crear un grupo dinámico y
 * después la promo dirigida a su customer_group_id). Si una acción falla, la
 * cadena se corta: las siguientes NO se ejecutan (evita cambios a medias).
 */
export async function executeProposal(
  store: AiStore,
  proposedActions: ProposedAction[],
  agentKey = 'proposal',
  nativeCtx?: NativeToolContext,
  /** Seam de tools. Default: el registry real. */
  toolRt: ToolRuntime = defaultToolRuntime,
): Promise<{
  status: 'executed' | 'failed';
  results: Array<{ tool: string; ok: boolean; text: string }>;
}> {
  const overrides = await loadOverrides(store);
  const tracer = new RunTracer(store, { agent_key: agentKey, kind: 'proposal_exec' });

  const results: Array<{ tool: string; ok: boolean; text: string }> = [];
  let prevResult: Record<string, unknown> | null = null;
  for (let i = 0; i < proposedActions.length; i++) {
    const a = proposedActions[i] as ProposedAction;
    const rawArgs = (a.args ?? {}) as Record<string, unknown>;
    const piped = resolvePipedArgs(rawArgs, prevResult);
    if (piped.error) {
      results.push({ tool: a.tool, ok: false, text: `Error de piping: ${piped.error}.` });
      await tracer.toolStep({ agentKey, name: a.tool, ok: false, detail: { piping: piped.error } });
      break;
    }
    const args = piped.args;
    const action = actionFromArgs(args);
    const resource = resourceFromArgs(args);
    const mode = resolveMode(a.tool, action, resource, overrides);
    if (mode === 'prohibited') {
      results.push({
        tool: a.tool,
        ok: false,
        text: 'Acción prohibida por la configuración del asistente. No se ejecutó.',
      });
      await tracer.toolStep({ agentKey, name: a.tool, ok: false, detail: { action, mode } });
      break;
    }
    const toolStart = Date.now();
    // nativeCtx habilita las acciones con tools NATIVAS (prepare_promotion,
    // create_blog_post, start_workflow…): sin él, executeNativeTool las rechaza
    // ("no está disponible en este contexto") y toda propuesta nativa fallaba.
    const text = await execTool(store, toolRt, a.tool, args, nativeCtx);
    const ok = !/^Error/.test(text);
    results.push({ tool: a.tool, ok, text });
    await tracer.toolStep({
      agentKey,
      name: a.tool,
      ok,
      durationMs: Date.now() - toolStart,
      detail: { action },
    });
    if (!ok) break;
    prevResult = extractActionResult(text);
  }
  // Las acciones que quedaron sin correr por el corte quedan registradas.
  for (let i = results.length; i < proposedActions.length; i++) {
    results.push({
      tool: (proposedActions[i] as ProposedAction).tool,
      ok: false,
      text: 'No ejecutada: una acción anterior de la propuesta falló.',
    });
  }
  const status = results.some((r) => !r.ok) ? 'failed' : 'executed';
  await tracer.finish(status === 'executed' ? 'complete' : 'error');
  return { status, results };
}
