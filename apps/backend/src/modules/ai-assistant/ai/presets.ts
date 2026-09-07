/**
 * Presets de corrida: qué sinks recibe cada tipo de turno.
 *
 * Despues de que el loop pasó a ser single-writer, lo único que distingue a un
 * turno de chat de uno headless o del bot de WhatsApp es a QUIÉN le escribe: el
 * cable SSE, la traza, la transcripción persistida, el buffer en memoria, la
 * cadena de pensamiento. Ese armado vivía disperso en cada loop; acá queda en un
 * lugar, que es donde se mira para responder "¿por qué esta corrida no aparece en
 * Logs?".
 *
 * El tope de pasos también se resuelve acá: antes había tres fuentes (la constante
 * del módulo, el 12 del motor de workflows y `settings.proposalsMaxSteps`), y era
 * imposible saber cuál mandaba sin leer los tres archivos.
 */
import { RunTracer } from './tracing';
import { MAX_STEPS } from './runtime';
import {
  ArrayTranscript,
  ChatMessageTranscript,
  EventBus,
  RunTraceSink,
  SseSink,
  WorkflowActivitySink,
} from './run-events';
import type { RunEventSink } from './run-events';
import type { AgentEvent, AiStore, ApiMessage } from './types';

export type Preset = {
  bus: EventBus;
  /** Tope de vueltas efectivo para este turno. */
  maxSteps: number;
};

/**
 * Chat del admin. Es el único que persiste la conversación en `chat_message` —de
 * ahí deriva la timeline `loadThreadView`— y el único que puede emitir al cable
 * SSE, cuando la route corre en streaming.
 */
export function chatPreset(opts: {
  store: AiStore;
  threadId: string;
  model?: string;
  onEvent?: (ev: AgentEvent) => void;
  /** Observadores adicionales del stream. No alteran el turno. */
  sinks?: RunEventSink[];
}): Preset & { tracer: RunTracer } {
  const tracer = new RunTracer(opts.store, {
    thread_id: opts.threadId,
    kind: 'chat',
    model: opts.model,
  });
  return {
    tracer,
    maxSteps: MAX_STEPS,
    bus: new EventBus({ kind: 'chat', threadId: opts.threadId }, [
      ...(opts.onEvent ? [new SseSink(opts.onEvent)] : []),
      new ChatMessageTranscript(opts.store, opts.threadId),
      new RunTraceSink(tracer),
      ...(opts.sinks ?? []),
    ]),
  };
}

/**
 * Análisis headless: el job de propuestas y los subagentes del motor de workflows.
 * La conversación vive en el array `messages`; cuando corre dentro de un workflow
 * suma la proyección a la "Cadena de pensamiento" del chat.
 */
export function analysisPreset(opts: {
  store: AiStore;
  agentKey: string;
  model?: string;
  messages: ApiMessage[];
  maxSteps?: number;
  onEvent?: (ev: AgentEvent) => void;
  activityContext?: { runId: string; stepKey: string };
  /** Observadores adicionales del stream. No alteran el turno. */
  sinks?: RunEventSink[];
}): Preset {
  const tracer = new RunTracer(opts.store, {
    agent_key: opts.agentKey,
    kind: 'proactive',
    model: opts.model,
  });
  return {
    maxSteps: opts.maxSteps ?? MAX_STEPS,
    bus: new EventBus({ kind: 'proactive', threadId: null }, [
      ...(opts.onEvent && opts.activityContext
        ? [new WorkflowActivitySink(opts.onEvent, opts.activityContext)]
        : []),
      new ArrayTranscript(opts.messages),
      new RunTraceSink(tracer),
      ...(opts.sinks ?? []),
    ]),
  };
}

/**
 * Bot de atención por WhatsApp.
 *
 * Desde este preset SÍ traza. Antes no lo hacía —era el único loop sin
 * `RunTracer`— y esa omisión no era una decisión sino una deuda: significaba que
 * una conversación del bot que salía mal no dejaba rastro en ninguna parte. Ahora
 * aparecen corridas con `kind: 'proactive'` en la pantalla de Logs.
 */
export function whatsappPreset(opts: {
  store: AiStore;
  agentKey: string;
  model?: string;
  messages: ApiMessage[];
  maxSteps?: number;
  /** Observadores adicionales del stream. No alteran el turno. */
  sinks?: RunEventSink[];
}): Preset {
  const tracer = new RunTracer(opts.store, {
    agent_key: opts.agentKey,
    kind: 'proactive',
    model: opts.model,
  });
  return {
    maxSteps: opts.maxSteps ?? MAX_STEPS,
    bus: new EventBus({ kind: 'whatsapp', threadId: null }, [
      new ArrayTranscript(opts.messages),
      new RunTraceSink(tracer),
      ...(opts.sinks ?? []),
    ]),
  };
}
