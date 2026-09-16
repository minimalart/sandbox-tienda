import { runHeadlessAnalysis } from './headless';
import { parseWorkflowResult, resultContract, validateWorkflowResult, type ResultContract, type WorkflowBlock } from './workflow-result';
import type { ModelProvider } from './chat-client';
import type { ToolRuntime } from './tool-registry';
import { memoryOptionsFromConfig } from './memory';
import type { AiStore, MemoryRuntimeOptions } from './types';
import { upsertCampaign, buildCampaignOutputsPatch, stepOut, strList } from './campaign';
import { ensureBannerMedia, ensureLandingContent, resolveProductTitles } from './campaign-enrich';
import type { NativeToolContext } from './native-tools';
import type { AgentEvent, ChatAttachment, WorkflowChecklistItem, WorkflowStepStatus } from './types';
import { BLOG_MODULE } from '../../blog';
import type BlogModuleService from '../../blog/service';
import { STORE_CONFIG_MODULE } from '../../store-config';
import type StoreConfigModuleService from '../../store-config/service';
import { renderBlogContentHtml } from '../../blog/render';
import { validateGeneratedBlogContentHtml } from './native-tools/blog-content-quality';

/**
 * Motor de workflows orquestados (determinístico). El Orquestador elige QUÉ
 * workflow correr (vía la tool `start_workflow`); este motor ejecuta los pasos
 * definidos EN ORDEN — y en paralelo los que comparten `parallel_group` — sin que
 * el LLM decida la secuencia. Cada paso DESPACHA un subagente headless
 * (`dispatchSubagent`) que ejecuta su tarea y DEVUELVE un resultado estructurado.
 * El estado compartido + el checklist se persisten en `ai_workflow_run` (para la
 * UI y para reanudar tras un HITL).
 */

export type WorkflowStep = {
  result_contract?: ResultContract;
  key: string;
  agent_key: string;
  task: string;
  parallel_group?: string | number | null;
  requires_approval?: boolean;
  output_key?: string;
  label?: string;
  /**
   * Condición para que el paso corra. Dot-path dentro de `{ input, state }`
   * (p. ej. `input.deliverables.blog_post`); si el valor es falsy / [] / '' el
   * paso se SALTEA. Permite armar el workflow dinámicamente según lo elegido
   * (campaña comercial: cada entregable habilita su paso). Sin `when` → siempre corre.
   */
  when?: string | null;
  /**
   * Qué hacer si el paso falla. `'continue'` = marcarlo failed en el checklist
   * pero SEGUIR con el workflow (para pasos de enriquecimiento no críticos:
   * portada/productos de la receta — un blip del proveedor no debe tirar el run
   * entero con el borrador ya creado). Default `'fail'`: el run queda failed.
   */
  on_error?: 'fail' | 'continue' | null;
};

export type WorkflowDefinitionData = {
  key: string;
  name: string;
  description?: string | null;
  steps: WorkflowStep[];
  final_action?: { type?: string | null } | null;
};

export type WorkflowRunResult = {
  runId: string;
  status: 'running' | 'needs_input' | 'completed' | 'failed';
  summary: string;
};

/** El store con el CRUD autogenerado del WorkflowRun (estructural, como AiStore). */
type RunStore = AiStore & {
  createWorkflowRuns(data: any): Promise<any>;
  updateWorkflowRuns(data: any): Promise<any>;
  retrieveWorkflowRun(id: string): Promise<any>;
};

function getPath(root: any, path: string): unknown {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), root);
}

/** Reemplaza {{input.x}} / {{state.step.campo}} en el template de la tarea. */
function interpolate(tpl: string, ctx: { input: unknown; state: unknown }): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, p: string) => {
    const val = getPath(ctx, p);
    if (val == null) return '';
    return typeof val === 'string' ? val : JSON.stringify(val);
  });
}

/**
 * Campos DERIVADOS del estado, solo para interpolar (fallbacks que `{{a||b}}` no
 * puede expresar). `ingredients_effective`: ingredientes del redactor, y si vienen
 * vacíos (p. ej. el redactor no los pobló), cae a los del investigador — así el paso
 * `productos` siempre tiene una lista con qué buscar en el catálogo. No se persiste
 * en `state` (solo se usa para armar el task del subagente).
 */
function withDerived(state: Record<string, unknown>): Record<string, unknown> {
  const asArr = (v: unknown): string[] =>
    Array.isArray(v)
      ? (v as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      : [];
  const red = state.redactar as Record<string, unknown> | undefined;
  const inv = state.investigar as Record<string, unknown> | undefined;
  const a = asArr(red?.ingredients);
  const ingredients_effective = a.length ? a : asArr(inv?.ingredients);
  return { ...state, ingredients_effective };
}

/** Resultado estructurado que cada subagente emite al final: <result>{json}</result>. */
function stripResult(text: string): string {
  // Saca el bloque <result> (datos estructurados) y también cualquier <proposal>
  // (convención del análisis proactivo): en la voz de un subagente de workflow no
  // van, y si el agente agotó pasos podía emitirlos y ensuciar el chat con JSON crudo.
  return text
    .replace(/<result>[\s\S]*?<\/result>/gi, '')
    .replace(/<proposal>[\s\S]*?<\/proposal>/gi, '')
    .trim();
}

function labelFor(s: WorkflowStep): string {
  // Nunca el `task` crudo (tiene plantillas {{…}}): solo un label limpio o la key.
  return s.label || s.key;
}

async function validateRecipeDraftArtifact(
  nativeCtx: NativeToolContext | undefined,
  value: Record<string, unknown>,
): Promise<string | undefined> {
  const postId = typeof value.post_id === 'string' ? value.post_id : '';
  if (!postId) {
    return 'El paso de redaccion no devolvio post_id; el workflow no puede validar ni enriquecer el borrador.';
  }
  if (!nativeCtx) {
    return undefined;
  }

  try {
    const service = nativeCtx.container.resolve(BLOG_MODULE) as unknown as BlogModuleService;
    const post = (await service.retrieveBlogPost(postId)) as Record<string, unknown>;
    const html = renderBlogContentHtml(post.content);
    const validation = validateGeneratedBlogContentHtml(html);
    if (!validation.ok) {
      return `${validation.message} El borrador ${postId} quedo guardado con ${validation.plainTextLength} caracteres de texto real.`;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'error desconocido';
    return `No se pudo validar el contenido persistido del borrador ${postId}: ${message}`;
  }

  return undefined;
}

/**
 * ¿El paso debe correr? Evalúa `when` (dot-path en {input,state}); falsy / [] / ''
 * = saltar. Sin `when` → corre siempre. Permite el armado dinámico del workflow.
 */
function shouldRun(s: WorkflowStep, ctx: { input: unknown; state: unknown }): boolean {
  if (!s.when) return true;
  const v = getPath(ctx, s.when);
  if (v == null || v === false || v === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

/** Agrupa pasos consecutivos con el mismo `parallel_group`; el resto van solos. */
function groupSteps(steps: WorkflowStep[]): WorkflowStep[][] {
  const groups: WorkflowStep[][] = [];
  for (const s of steps) {
    const g = s.parallel_group;
    const last = groups[groups.length - 1];
    if (g != null && g !== '' && last && last[0]?.parallel_group === g) last.push(s);
    else groups.push([s]);
  }
  return groups;
}

/**
 * Despacha un subagente headless con una tarea y devuelve su resultado. El
 * subagente nunca habla con el usuario ni deriva; corre aislado y vuelve.
 */
async function dispatchSubagent(
  store: AiStore,
  nativeCtx: NativeToolContext | undefined,
  agentKey: string,
  task: string,
  images?: ChatAttachment[],
  activity?: { runId: string; stepKey: string; onEvent?: (ev: AgentEvent) => void },
  memory?: MemoryRuntimeOptions,
  runtime?: { modelProvider?: ModelProvider; toolRuntime?: ToolRuntime; workflowContract?: ResultContract },
): Promise<{ text: string; data: Record<string, unknown> | null }> {
  // Presupuesto explícito: los modelos de razonamiento (gpt-5*) gastan reasoning tokens
  // que cuentan contra `max_tokens`; con el default chico truncaban la salida. reasoning
  // bajo + max_tokens holgado = artículo completo. `activity` (opcional) surfacea en vivo
  // las búsquedas/fuentes del subagente en la UI (Cadena de pensamiento del workflow).
  const raw = await runHeadlessAnalysis({
    ...runtime,
    store,
    agentKey,
    task,
    nativeCtx,
    attachments: images,
    maxTokens: 8000,
    reasoningEffort: 'low',
    // Margen de pasos holgado: el paso de catálogo busca y VINCULA un producto por
    // ingrediente (varias tools), y con el default (8) se quedaba sin pasos antes de
    // linkear. Los demás subagentes cierran mucho antes, así que subirlo no los afecta.
    maxSteps: 12,
    memory,
    onEvent: activity?.onEvent,
    activityContext: activity ? { runId: activity.runId, stepKey: activity.stepKey } : undefined,
  });
  return { text: stripResult(raw), data: parseWorkflowResult(raw) };
}

/**
 * Imágenes adjuntas del último mensaje del usuario del hilo (el que disparó el
 * workflow): se pasan a cada subagente como contexto visual (vía su URL pública
 * ya persistida en el adjunto). Best-effort: ante cualquier error devuelve [].
 */
async function loadTriggerImages(
  store: AiStore,
  threadId: string | null | undefined,
): Promise<ChatAttachment[]> {
  if (!threadId) return [];
  try {
    const rows = await store.listChatMessages(
      { thread_id: threadId },
      { order: { created_at: 'ASC' }, take: 1000 },
    );
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (r.role === 'user' && Array.isArray(r.attachments) && r.attachments.length > 0) {
        const imgs = (r.attachments as ChatAttachment[]).filter((a) => a.kind === 'image');
        if (imgs.length > 0) return imgs;
      }
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Al terminar el workflow de CAMPAÑA COMERCIAL, vuelca los outputs de cada paso al
 * estado de la campaña y la deja en status "preview" — DETERMINÍSTICAMENTE. Así el
 * orquestador no tiene que reconstruir los outputs de un resumen de texto, y los
 * botones del preview (aplicar promo, publicar nota/banner/landing) encuentran los
 * ids reales. Es un caso específico por key, igual que el rescate de "receta".
 * Best-effort: cualquier error se traga (no debe tirar el run ya completado).
 */
async function finalizeCampaign(
  store: AiStore,
  threadId: string | null | undefined,
  state: Record<string, unknown>,
): Promise<void> {
  if (!threadId) return;
  await upsertCampaign({
    store,
    threadId,
    patch: buildCampaignOutputsPatch(state),
    statusOverride: 'preview',
  }).catch(() => {});
}

/** Ejecuta (o reanuda) un workflow determinístico. */
export async function runWorkflow(opts: {
  modelProvider?: ModelProvider;
  toolRuntime?: ToolRuntime;
  store: AiStore;
  nativeCtx?: NativeToolContext;
  definition: WorkflowDefinitionData;
  input?: Record<string, unknown>;
  threadId?: string | null;
  createdBy?: string | null;
  onEvent?: (ev: AgentEvent) => void;
  /** Para reanudar una corrida pausada en needs_input. */
  runId?: string;
}): Promise<WorkflowRunResult> {
  const { definition, createdBy = null, onEvent } = opts;
  const store = opts.store as RunStore;
  const nativeCtx = opts.nativeCtx;

  let run = opts.runId ? await store.retrieveWorkflowRun(opts.runId).catch(() => null) : null;
  const input = opts.input ?? run?.input ?? {};
  const threadId = opts.threadId ?? run?.thread_id ?? null;
  const state: Record<string, unknown> = (run?.state as Record<string, unknown>) ?? {};
  // Armado dinámico: solo los pasos cuyo `when` se cumple (según el input/estado).
  // Los saltados no aparecen en el checklist ni se ejecutan. Se evalúa sobre el
  // input + estado actual (al reanudar, contra el estado ya persistido).
  const steps = definition.steps.filter((st) => shouldRun(st, { input, state }));
  const checklist: WorkflowChecklistItem[] =
    (run?.checklist as WorkflowChecklistItem[]) ??
    steps.map((st) => ({
      key: st.key,
      agent_key: st.agent_key,
      label: labelFor(st),
      status: 'pending' as WorkflowStepStatus,
    }));

  if (!run) {
    const created = await store.createWorkflowRuns({
      workflow_key: definition.key,
      thread_id: threadId,
      status: 'running',
      input,
      state,
      checklist,
      created_by: createdBy,
    });
    run = Array.isArray(created) ? created[0] : created;
  }
  const runId: string = run.id;
  onEvent?.({ type: 'workflow_started', run_id: runId, workflow_key: definition.key, checklist });

  // Imágenes del pedido (mensaje disparador): se pasan a los subagentes como
  // contexto visual, igual que las ve el Orquestador en el chat.
  const triggerImages = await loadTriggerImages(store, threadId);

  // Memoria para los subagentes: cada paso (p. ej. el redactor de recetas) arranca
  // con las reglas de negocio/decisiones guardadas inyectadas en su prompt + la tool
  // `search_memory`, con la misma config de store-config que usan el chat y las
  // propuestas. Best-effort: sin store-config o con memoria apagada, corre como antes.
  let memory: MemoryRuntimeOptions | undefined;
  try {
    const storeConfig = nativeCtx?.container.resolve<StoreConfigModuleService>(STORE_CONFIG_MODULE);
    if (storeConfig) memory = memoryOptionsFromConfig(await storeConfig.getAiConfig(), createdBy);
  } catch {
    // sin config → sin memoria (regresión cero)
  }

  const setStatus = (key: string, status: WorkflowStepStatus, result_summary?: string) => {
    const item = checklist.find((c) => c.key === key);
    if (item) {
      item.status = status;
      if (result_summary !== undefined) item.result_summary = result_summary;
    }
    onEvent?.({
      type: 'workflow_step',
      run_id: runId,
      step_key: key,
      agent_key: item?.agent_key ?? '',
      label: item?.label ?? key,
      status,
      result_summary,
    });
  };
  const persist = async (status?: WorkflowRunResult['status']) => {
    await store.updateWorkflowRuns({ id: runId, state, checklist, ...(status ? { status } : {}) });
  };

  // Gate de aprobación por paso: una vez aprobado, queda marcado en state.__approved.
  const approved = ((state.__approved as Record<string, boolean>) ??= {});

  try {
    for (const pendingGroup of groupSteps(steps)) {
      const group = pendingGroup.filter(st => checklist.find(c => c.key === st.key)?.status !== 'completed');
      // Reanudación: saltear grupos ya completados.
      if (group.length === 0) {
        continue;
      }
      // Pausa HITL antes de un paso que requiere aprobación y aún no se aprobó.
      const gate = group.find((st) => st.requires_approval && !approved[st.key]);
      if (gate) {
        setStatus(gate.key, 'needs_input');
        await persist('needs_input');
        onEvent?.({ type: 'workflow_done', run_id: runId, status: 'needs_input' });
        return { runId, status: 'needs_input', summary: `Esperando aprobación: ${labelFor(gate)}` };
      }

      group.forEach((st) => setStatus(st.key, 'in_progress'));
      await persist();

      const results = await Promise.all(
        group.map(async (st) => {
          try {
            const contract = resultContract(definition.key, st.key, st.result_contract);
            if (!contract || !Object.keys(contract).length) {
              return { st, ok: false, value: null, block: { status: 'blocked' as const, code: 'missing_contract', reason: 'El paso no tiene un contrato de resultado definido.', missing_fields: [] }, summary: 'El paso no tiene un contrato de resultado definido.', text: '' };
            }
            const task = interpolate(st.task, { input, state: withDerived(state) });
            const { text, data } = await dispatchSubagent(
              store,
              nativeCtx,
              st.agent_key,
              task,
              triggerImages,
              { runId, stepKey: st.key, onEvent },
              memory,
              { modelProvider: opts.modelProvider, toolRuntime: opts.toolRuntime,
                workflowContract: contract },
            );
            const validation = validateWorkflowResult(data, contract);
            if (!validation.ok) return { st, ok: false, value: null, block: validation.block, summary: validation.block.reason, text: '' };
            const value = validation.data;
            if (definition.key === 'receta' && st.key === 'redactar') {
              const artifactError = await validateRecipeDraftArtifact(nativeCtx, value);
              if (artifactError) {
                return { st, ok: false, value, summary: artifactError.slice(0, 300), text };
              }
            }
            if (definition.key === 'campania_comercial' && nativeCtx) {
              // Enriquecimiento determinístico: los subagentes cerraban "en verde"
              // con el banner sin imagen y la landing vacía. El motor completa acá
              // lo que falte; si no puede, el paso queda `failed` HONESTO en el
              // checklist (on_error continue: el run sigue igual).
              const campaign = (input.campaign ?? {}) as Record<string, unknown>;
              const campaignName = typeof campaign.name === 'string' ? campaign.name : 'Campaña';
              if (st.key === 'crear_banner') {
                const bannerId = typeof value.banner_id === 'string' ? value.banner_id : '';
                if (!bannerId) {
                  return { st, ok: false, value, summary: 'El paso no devolvió banner_id.', text };
                }
                const tone = Array.isArray(campaign.tone) ? (campaign.tone as string[]).join(', ') : '';
                const status = await ensureBannerMedia(nativeCtx.container, bannerId, {
                  prompt:
                    `Wide 16:9 promotional hero banner image for a retail campaign named "${campaignName}".` +
                    (tone ? ` Mood: ${tone}.` : '') +
                    ' Vibrant, professional product/lifestyle photography, appealing composition, no text or letters in the image.',
                  alt: `Banner de la campaña ${campaignName}`,
                });
                if (status === 'failed') {
                  return {
                    st,
                    ok: false,
                    value,
                    summary: `Banner ${bannerId} creado pero SIN imagen (la generación de media falló).`,
                    text,
                  };
                }
              }
              if (st.key === 'crear_landing') {
                const landingId = typeof value.landing_id === 'string' ? value.landing_id : '';
                if (!landingId) {
                  return { st, ok: false, value, summary: 'El paso no devolvió landing_id.', text };
                }
                const resolved = state.resolver_productos as Record<string, unknown> | undefined;
                const productIds = Array.isArray(resolved?.product_ids)
                  ? (resolved.product_ids as string[]).filter((x) => typeof x === 'string')
                  : [];
                const productTitles = await resolveProductTitles(nativeCtx.container, productIds);
                const status = await ensureLandingContent(nativeCtx.container, landingId, {
                  campaignName,
                  tone: Array.isArray(campaign.tone) ? (campaign.tone as string[]) : undefined,
                  objective: Array.isArray(campaign.objective) ? (campaign.objective as string[]) : undefined,
                  startDate: typeof campaign.start_date === 'string' ? campaign.start_date : undefined,
                  endDate: typeof campaign.end_date === 'string' ? campaign.end_date : undefined,
                  promotion: (input.promotion ?? null) as { type?: string; value?: number | null } | null,
                  productTitles,
                });
                if (status === 'failed') {
                  return {
                    st,
                    ok: false,
                    value,
                    summary: `Landing ${landingId} creada pero VACÍA (no se pudo componer el contenido).`,
                    text,
                  };
                }
              }
            }
            const summary = (data ? JSON.stringify(data) : text).slice(0, 300);
            return { st, ok: true, value, summary, text };
          } catch (e) {
            return { st, ok: false, value: null, summary: (e as Error).message, text: '' };
          }
        }),
      );

      const blocks = (state.__blocked ??= {}) as Record<string, WorkflowBlock>;
      for (const r of results) {
        const block = 'block' in r ? r.block : undefined;
        if (r.ok) {
          state[r.st.output_key || r.st.key] = r.value;
          delete blocks[r.st.key];
        } else {
          delete state[r.st.output_key || r.st.key];
          blocks[r.st.key] = block ?? { status: 'blocked', code: 'step_failed', reason: r.summary, missing_fields: [] };
        }
        setStatus(r.st.key, r.ok ? 'completed' : block && r.st.on_error !== 'continue' ? 'needs_input' : 'failed', r.summary);
        // Mensaje breve del subagente → se muestra como burbuja de chat (su "voz").
        if (r.ok && r.text.trim()) {
          onEvent?.({
            type: 'workflow_message',
            run_id: runId,
            agent_key: r.st.agent_key,
            text: r.text.trim(),
          });
        }
      }
      await persist();

      // Solo los pasos SIN `on_error: 'continue'` tiran abajo el run: los de
      // enriquecimiento quedan `failed` en el checklist pero el workflow sigue
      // (el resumen final los reporta para que el orquestador lo diga honesto).
      const blocking = results.filter((r) => !r.ok && r.st.on_error !== 'continue');
      if (blocking.length > 0) {
        const status = blocking.some(r => 'block' in r && r.block) ? 'needs_input' : 'failed';
        await persist(status);
        onEvent?.({ type: 'workflow_done', run_id: runId, status });
        const detail = blocking
          .map((r) => `${labelFor(r.st)}: ${r.summary}`)
          .join(' | ');
        return { runId, status, summary: `Workflow detenido: ${detail}` };
      }
    }

    // Acción final: 'confirm' deja el run en needs_input (el Orquestador pide OK).
    const status: WorkflowRunResult['status'] =
      definition.final_action?.type === 'confirm' ? 'needs_input' : 'completed';
    await store
      .updateWorkflowRuns({
        id: runId,
        state,
        checklist,
        status,
        ...(status === 'completed' ? { completed_at: new Date() } : {}),
      });

    // Campaña comercial: volcamos los outputs de cada paso al estado de la campaña y
    // la dejamos en "preview" acá (determinístico), y devolvemos un resumen propio del
    // dominio. El resumen receta-shaped de abajo daba todo null para una campaña y hacía
    // que el orquestador leyera el "needs_input" como que debía intervenir → escapaba del
    // wizard con un handoff a "catalogo" en vez de mostrar el preview.
    if (definition.key === 'campania_comercial') {
      await finalizeCampaign(store, threadId, state);
      const validar = stepOut(state, 'validar');
      const summary = JSON.stringify({
        campaign: true,
        status,
        outputs_guardados: true,
        is_ready: typeof validar.is_ready === 'boolean' ? validar.is_ready : null,
        warnings: strList(validar.warnings),
        pasos_fallidos: checklist.filter((c) => c.status === 'failed').map((c) => c.label ?? c.key),
      });
      onEvent?.({ type: 'workflow_done', run_id: runId, status });
      return { runId, status, summary };
    }
    // Artefacto principal (el borrador) y faltantes, para que la UI los muestre al cerrar
    // de forma fiable (sin depender de que el orquestador los repita en su mensaje).
    const artifact = (() => {
      for (const v of Object.values(state)) {
        const o = v as Record<string, unknown> | null;
        if (o && typeof o === 'object' && typeof o.preview_url === 'string') {
          return { preview_url: o.preview_url, post_id: typeof o.post_id === 'string' ? o.post_id : null };
        }
      }
      return undefined;
    })();
    const unmatched = (() => {
      for (const v of Object.values(state)) {
        const o = v as Record<string, unknown> | null;
        if (o && typeof o === 'object' && Array.isArray(o.unmatched)) {
          return (o.unmatched as unknown[]).filter((x): x is string => typeof x === 'string');
        }
      }
      return undefined;
    })();
    // Resumen LEGIBLE para que el orquestador cierre diciendo CONCRETAMENTE qué hizo
    // (en vez de recibir un volcado JSON del state completo).
    const productCount = (() => {
      for (const v of Object.values(state)) {
        const o = v as Record<string, unknown> | null;
        if (o && typeof o === 'object' && Array.isArray(o.product_ids)) {
          return (o.product_ids as unknown[]).length;
        }
      }
      return undefined;
    })();
    // Pasos tolerados que fallaron (on_error continue): el orquestador debe
    // contarlo ("no pude generar la portada"), no fingir que salió todo.
    const failedSteps = checklist
      .filter((c) => c.status === 'failed')
      .map((c) => c.label ?? c.key);
    const summary = JSON.stringify({
      preview_url: artifact?.preview_url ?? null,
      post_id: artifact?.post_id ?? null,
      productos_vinculados: productCount,
      ingredientes_sin_producto: unmatched ?? [],
      ...(failedSteps.length > 0 ? { pasos_fallidos_no_criticos: failedSteps } : {}),
    });
    onEvent?.({ type: 'workflow_done', run_id: runId, status, artifact, unmatched });
    return { runId, status, summary };
  } catch (e) {
    await store
      .updateWorkflowRuns({ id: runId, state, checklist, status: 'failed', error: (e as Error).message })
      .catch(() => {});
    onEvent?.({ type: 'workflow_done', run_id: runId, status: 'failed' });
    return { runId, status: 'failed', summary: (e as Error).message };
  }
}
