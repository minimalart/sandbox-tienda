/**
 * Stream de eventos de una corrida del agente.
 *
 * La regla: el loop decide CUÁNDO ocurre algo, las capabilities deciden CÓMO, y
 * los eventos registran QUÉ ocurrió. Antes de esto el loop escribía a tres
 * destinos distintos a mano —`onEvent` (SSE), `RunTracer` (ai_agent_run/step) y
 * `createChatMessages` (transcripción)— repartidos en 14 llamadas. Ahora emite
 * hechos y cada destino es un sink que PROYECTA ese hecho a su formato.
 *
 * Dos tipos de evento, y no es duplicación:
 *
 *  - `RunEvent` (acá) es el vocabulario de dominio. Lleva duración, tokens, modo
 *    de policy, ids de memoria: cosas que no deben viajar al browser.
 *  - `AgentEvent` (en `./types`) es el formato de CABLE del SSE. Su forma la dicta
 *    el reducer del chat del admin, 6 de sus 13 variantes las emite el motor de
 *    workflows (no el loop), y está espejado a mano en `admin/.../hooks.tsx`, que
 *    CI no typechequea. Por eso no se toca: `toSseFrame` proyecta hacia él y
 *    devuelve `null` para todo lo que hoy no se muestra.
 *
 * La proyección es lossy a propósito y en un solo sentido. Que `RunTracer` exista
 * es justamente porque el frame SSE perdía duración y tokens.
 */
import { SEARCH_MEMORY_TOOL } from './policy';
import type { RunKind, RunStatus, RunTracer } from './tracing';
import type { AgentEvent, AiStore, ApiMessage, PendingToolCall, PolicyMode, ToolCall } from './types';

/** Un tool call ya parseado y clasificado por la policy. */
export type ClassifiedToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  action: string;
  resource: string;
  mode: PolicyMode;
};

/** Identidad de la corrida. No es `ai_agent_run.id`: ese se crea lazy en el tracer. */
export type RunMeta = {
  kind: RunKind | 'whatsapp';
  threadId: string | null;
};

export type RunEvent =
  | { type: 'turn_started'; at: number; maxSteps: number }
  | { type: 'step_started'; at: number; idx: number; agentKey: string }
  | { type: 'memory_retrieved'; at: number; agentKey: string; ids: string[] }
  | {
      type: 'assistant_chunk';
      at: number;
      channel: 'content' | 'reasoning';
      text: string;
    }
  | {
      /** El modelo respondió. Es el hecho que alimenta el step `model` de la traza. */
      type: 'model_completed';
      at: number;
      idx: number;
      agentKey: string;
      model?: string;
      purpose: 'step' | 'correction' | 'closing';
      durationMs: number;
      promptTokens?: number;
      completionTokens?: number;
      finishReason?: string | null;
    }
  | {
      /** Un mensaje del assistant que hay que dejar asentado en la transcripción. */
      type: 'assistant_message';
      at: number;
      agentKey?: string;
      content: string;
      toolCalls: ToolCall[];
      status: 'complete' | 'pending';
    }
  | { type: 'tool_called'; at: number; agentKey: string; call: ClassifiedToolCall }
  | {
      type: 'tool_completed';
      at: number;
      agentKey: string;
      call: ClassifiedToolCall;
      text: string;
      ok: boolean;
      durationMs: number;
    }
  | {
      /** No se ejecutó: la prohibió la policy, la rechazó el usuario, o quedó
       *  colgada de un handoff. `by` es la traza de auditoría del consentimiento. */
      type: 'tool_rejected';
      at: number;
      agentKey: string;
      call: ClassifiedToolCall;
      by: 'policy' | 'human' | 'handoff';
      text: string;
    }
  | { type: 'tool_suspended'; at: number; agentKey: string; pending: PendingToolCall[] }
  | {
      /** Cierre de una vuelta. `outcome` dice por qué terminó, que es lo que
       *  distingue a un driver de otro sin que cambien los hechos. */
      type: 'step_completed';
      at: number;
      idx: number;
      agentKey: string;
      outcome: 'tools' | 'answered' | 'handoff' | 'suspended';
    }
  | {
      type: 'agent_handoff';
      at: number;
      from: string;
      target: string;
      reason?: string;
      callId: string;
      ok: boolean;
      text: string;
    }
  | { type: 'grounding_judged'; at: number; verdict: unknown }
  | { type: 'turn_completed'; at: number; status: RunStatus; error?: string };

// ── Bus ──────────────────────────────────────────────────────────────────────

export type RunEventSink = {
  emit(ev: RunEvent, meta: RunMeta): void | Promise<void>;
};

/**
 * Despacha a los sinks EN ORDEN DE ARRAY y SECUENCIALMENTE. Las dos invariantes
 * dependen de eso:
 *
 *  1. `ai_agent_step.idx` se incrementa por escritura, y la pantalla de Logs
 *     ordena por `idx`: un despacho concurrente mezclaría los pasos.
 *  2. La transcripción tiene que estar en la DB antes de que la vuelta siguiente
 *     relea el hilo con `loadRows()`.
 *
 * Un sink que tira NO rompe el turno: mismo contrato best-effort que ya tenía
 * `RunTracer`, cuyo cuerpo entero vive dentro de try/catch vacíos.
 */
export class EventBus {
  constructor(
    readonly meta: RunMeta,
    private readonly sinks: RunEventSink[],
  ) {}

  async emit(ev: RunEvent): Promise<void> {
    for (const sink of this.sinks) {
      try {
        const r = sink.emit(ev, this.meta);
        // Sólo se espera si el sink devolvió promesa: en el camino sincrónico
        // (el SSE es `res.write`) no se agrega ni un microtask.
        if (r) await r;
      } catch {
        // best-effort
      }
    }
  }

  /** Para `assistant_chunk`, que llega por token. Sólo sinks sincrónicos lo consumen. */
  emitSync(ev: RunEvent): void {
    for (const sink of this.sinks) {
      try {
        void sink.emit(ev, this.meta);
      } catch {
        // best-effort
      }
    }
  }
}

// ── Proyecciones ─────────────────────────────────────────────────────────────

/**
 * Al cable SSE. `null` = este hecho no se muestra en vivo.
 *
 * Este mapa ES la garantía de paridad del refactor: cubre exactamente los 6
 * `onEvent?.()` que el loop tenía a mano, y nada más.
 */
export function toSseFrame(ev: RunEvent): AgentEvent | null {
  switch (ev.type) {
    case 'step_started':
      return { type: 'step', agent: ev.agentKey };
    case 'assistant_chunk':
      return ev.channel === 'content'
        ? { type: 'token', text: ev.text }
        : { type: 'reasoning', text: ev.text };
    case 'tool_called':
      return { type: 'tool_call', name: ev.call.name, action: ev.call.action };
    case 'tool_completed':
      return { type: 'tool_result', name: ev.call.name, ok: ev.ok };
    case 'agent_handoff':
      return { type: 'handoff', from: ev.from, target: ev.target, reason: ev.reason };
    case 'tool_rejected':
      // Paridad exacta: una tool prohibida o rechazada por el usuario SÍ emitía
      // su `tool_result` con ok=false. Las hermanas de un handoff no emitían
      // nada — esa rama sólo mandaba el frame `handoff`.
      return ev.by === 'handoff'
        ? null
        : { type: 'tool_result', name: ev.call.name, ok: false };
    default:
      return null;
  }
}

/** Fila nueva de `chat_message` (sin `thread_id`: lo pone el sink). */
export type TranscriptRow = {
  role: 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  status?: 'complete' | 'pending';
  agent_key?: string | null;
};

/** A la transcripción persistida, de donde `loadThreadView` deriva la timeline. */
export function toTranscriptRows(ev: RunEvent): TranscriptRow[] {
  switch (ev.type) {
    case 'assistant_message':
      return [
        {
          role: 'assistant',
          content: ev.content,
          ...(ev.toolCalls.length > 0 ? { tool_calls: ev.toolCalls } : {}),
          status: ev.status,
          agent_key: ev.agentKey,
        },
      ];
    case 'tool_completed':
      return [{ role: 'tool', tool_call_id: ev.call.id, content: ev.text }];
    case 'tool_rejected':
      return [{ role: 'tool', tool_call_id: ev.call.id, content: ev.text }];
    case 'agent_handoff':
      return [{ role: 'tool', tool_call_id: ev.callId, content: ev.text }];
    default:
      return [];
  }
}

/**
 * Al buffer efímero `ApiMessage[]` que usan los loops headless y de WhatsApp en
 * vez de `chat_message`. Misma información, otro soporte.
 */
export function toApiMessages(ev: RunEvent): ApiMessage[] {
  switch (ev.type) {
    case 'assistant_message':
      return [
        {
          role: 'assistant',
          content: ev.content,
          ...(ev.toolCalls.length > 0 ? { tool_calls: ev.toolCalls } : {}),
        },
      ];
    case 'tool_completed':
      return [{ role: 'tool', content: ev.text, tool_call_id: ev.call.id }];
    case 'tool_rejected':
      return [{ role: 'tool', content: ev.text, tool_call_id: ev.call.id }];
    case 'agent_handoff':
      return [{ role: 'tool', content: ev.text, tool_call_id: ev.callId }];
    default:
      return [];
  }
}

// ── Sinks ────────────────────────────────────────────────────────────────────

/** Escribe los frames que el chat del admin ya sabe parsear. */
export class SseSink implements RunEventSink {
  constructor(private readonly write: (frame: AgentEvent) => void) {}
  emit(ev: RunEvent): void {
    const frame = toSseFrame(ev);
    if (frame) this.write(frame);
  }
}

/**
 * Envuelve al `RunTracer` sin modificarlo: `ai_agent_run` / `ai_agent_step` y la
 * pantalla de Logs siguen viendo exactamente lo mismo que antes.
 */
export class RunTraceSink implements RunEventSink {
  private readonly injectedMemoryIds = new Set<string>();
  private status: RunStatus = 'complete';
  private error: string | undefined;

  constructor(private readonly tracer: RunTracer) {}

  async emit(ev: RunEvent): Promise<void> {
    switch (ev.type) {
      case 'model_completed':
        await this.tracer.modelStep({
          agentKey: ev.agentKey,
          model: ev.model,
          durationMs: ev.durationMs,
          promptTokens: ev.promptTokens,
          completionTokens: ev.completionTokens,
          finishReason: ev.finishReason,
        });
        return;
      case 'tool_completed':
        await this.tracer.toolStep({
          agentKey: ev.agentKey,
          name: ev.call.name,
          ok: ev.ok,
          durationMs: ev.durationMs,
          detail: { action: ev.call.action },
        });
        return;
      case 'tool_rejected':
        // Las hermanas de un handoff se trazaban como `ok: true` (no fallaron:
        // simplemente no corrieron). Se conserva tal cual.
        await this.tracer.toolStep({
          agentKey: ev.agentKey,
          name: ev.call.name,
          ok: ev.by === 'handoff',
          detail: { action: ev.call.action, mode: ev.call.mode, by: ev.by, reason: ev.text, outcome: ev.by === 'policy' ? 'permissions_blocked' : 'rejected' },
        });
        return;
      case 'agent_handoff':
        await this.tracer.toolStep({
          agentKey: ev.from,
          name: `handoff → ${ev.target}`,
          handoff: true,
          ok: ev.ok,
          detail: { target: ev.target },
        });
        return;
      case 'memory_retrieved':
        for (const id of ev.ids) this.injectedMemoryIds.add(id);
        return;
      case 'grounding_judged':
        this.tracer.setGroundedness(ev.verdict);
        return;
      case 'turn_completed':
        this.status = ev.status;
        this.error = ev.error;
        if (this.injectedMemoryIds.size > 0) {
          this.tracer.setInjectedMemoryIds([...this.injectedMemoryIds]);
        }
        await this.tracer.finish(this.status, this.error);
        return;
      default:
        return;
    }
  }

  /** Ids acumulados, para que el loop pueda hacer `touchMemories` al cerrar. */
  memoryIds(): string[] {
    return [...this.injectedMemoryIds];
  }
}

/** Persiste la transcripción en `chat_message` (el hilo del chat del admin). */
export class ChatMessageTranscript implements RunEventSink {
  constructor(
    private readonly store: AiStore,
    private readonly threadId: string,
  ) {}
  async emit(ev: RunEvent): Promise<void> {
    for (const row of toTranscriptRows(ev)) {
      await this.store.createChatMessages({ thread_id: this.threadId, ...row });
    }
  }
}

/**
 * Transcripción en memoria: el mismo stream, sobre el `ApiMessage[]` que usan los
 * loops sin hilo persistido. Es lo que vuelve unificables a los tres loops.
 */
export class ArrayTranscript implements RunEventSink {
  constructor(private readonly messages: ApiMessage[] = []) {}
  emit(ev: RunEvent): void {
    this.messages.push(...toApiMessages(ev));
  }
  history(): ApiMessage[] {
    return this.messages;
  }
}

// ── Proyección a la "Cadena de pensamiento" ──────────────────────────────────

/** Host legible de una URL, para rotular una fuente. */
function safeHost(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, '');
  } catch {
    return u.slice(0, 40);
  }
}

/**
 * Etiqueta humana de un tool_call de un subagente para la Cadena de pensamiento del
 * workflow (Tavily trae {query}; Firecrawl {url|urls}). Cae a un genérico para otras
 * tools. Distinta de `activityLabel` (más abajo), que rotula la traza de actividad del chat.
 */
function searchActivityLabel(name: string, args: Record<string, unknown>): string {
  const q = typeof args.query === 'string' ? args.query : undefined;
  const url =
    typeof args.url === 'string'
      ? args.url
      : Array.isArray(args.urls) && typeof args.urls[0] === 'string'
        ? (args.urls[0] as string)
        : undefined;
  if (name.includes('tavily')) return q ? `Buscando en la web: ${q}` : 'Buscando en la web…';
  if (name.includes('firecrawl')) return url ? `Leyendo ${safeHost(url)}…` : 'Leyendo la fuente…';
  return `Consultando ${name}…`;
}

/** Extrae hasta 6 URLs del resultado JSON de tavily/firecrawl (best-effort). */
function parseResultUrls(text: string): string[] {
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const raw = (j.results as unknown) ?? (j.data as unknown) ?? (j.sources as unknown);
    if (!Array.isArray(raw)) return [];
    return raw
      .map((r) =>
        r && typeof r === 'object'
          ? ((r as Record<string, unknown>).url ?? (r as Record<string, unknown>).sourceURL)
          : undefined,
      )
      .filter((u): u is string => typeof u === 'string')
      .slice(0, 6);
  } catch {
    return [];
  }
}

/**
 * Proyecta el stream a la "Cadena de pensamiento" del chat: qué está por hacer
 * un subagente de workflow y qué fuentes encontró. Es una TERCERA vista de los
 * mismos hechos, junto al frame SSE y a la fila de traza.
 *
 * Vive acá y no en `run-events.ts` porque usa los helpers de presentación en
 * español; moverlos allá volvería a cerrar un ciclo de imports.
 */
export class WorkflowActivitySink implements RunEventSink {
  constructor(
    private readonly onEvent: (ev: AgentEvent) => void,
    private readonly ctx: { runId: string; stepKey: string },
  ) {}

  emit(ev: RunEvent): void {
    if (ev.type === 'tool_called') {
      if (ev.call.name === SEARCH_MEMORY_TOOL) return;
      const isSearch =
        ev.call.name.includes('tavily') || ev.call.name.includes('firecrawl');
      this.onEvent({
        type: 'workflow_activity',
        run_id: this.ctx.runId,
        step_key: this.ctx.stepKey,
        agent_key: ev.agentKey,
        kind: isSearch ? 'search' : 'tool',
        label: searchActivityLabel(ev.call.name, ev.call.args),
      });
      return;
    }
    if (ev.type === 'tool_rejected' || ev.type === 'model_completed') {
      this.onEvent({
        type: 'workflow_activity', run_id: this.ctx.runId, step_key: this.ctx.stepKey,
        agent_key: ev.agentKey, kind: 'tool',
        label: ev.type === 'tool_rejected' ? ev.text : 'El modelo terminó de responder; el resultado del paso todavía debe validarse.',
      });
      return;
    }
    if (ev.type === 'tool_completed') {
      for (const u of parseResultUrls(ev.text)) {
        this.onEvent({
          type: 'workflow_activity',
          run_id: this.ctx.runId,
          step_key: this.ctx.stepKey,
          agent_key: ev.agentKey,
          kind: 'source',
          label: safeHost(u),
          url: u,
        });
      }
    }
  }
}
