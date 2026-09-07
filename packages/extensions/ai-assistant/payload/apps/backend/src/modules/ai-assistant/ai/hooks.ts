/**
 * Interceptores del loop agéntico.
 *
 * Cierran la regla que guía todo el refactor: el loop decide CUÁNDO ocurre algo,
 * las capabilities deciden CÓMO, y los eventos registran QUÉ. Sin estos puntos de
 * enganche, cada policy, approval o validación nueva termina como una condición
 * más adentro del `for` — que es exactamente cómo `agent.ts` llegó a 1854 líneas.
 *
 * Diseño deliberadamente chico:
 *
 *  - Es un objeto plano, no un registry con suscripción y prioridades. Si hacen
 *    falta dos consumidores, se componen a mano con `mergeHooks`.
 *  - Todos los hooks son opcionales y todos pueden devolver `void`, que significa
 *    "no intervengo" = el comportamiento de hoy, tal cual.
 *  - Los hooks NO emiten eventos. Mutan lo que devuelven y el loop emite el hecho
 *    resultante; si un hook pudiera emitir, el stream dejaría de ser el registro
 *    de lo que el loop realmente hizo.
 *
 * Vive en su propio archivo y no en `types.ts` porque necesita `ChatRequest` de
 * `chat-client`, y `chat-client` importa `types`: meterlo allá cerraría un ciclo.
 */
import type { ChatRequest } from './chat-client';
import type { ClassifiedToolCall, RunMeta } from './run-events';
import type { AgentResult } from './types';

/** Lo que el hook necesita saber del agente activo, sin arrastrar `ResolvedAgent`. */
export type HookAgent = {
  key: string;
  model?: string;
  maxTokens?: number;
};

export type StepContext = {
  run: RunMeta;
  /** Índice de la vuelta, base 0. */
  step: number;
  maxSteps: number;
  agent: HookAgent;
};

export type ModelRequestContext = StepContext & {
  purpose: 'step' | 'correction' | 'closing';
  request: ChatRequest;
};

export type ToolExecuteContext = StepContext & {
  call: ClassifiedToolCall;
  /** Tool sintética que el loop intercepta (no va al registry). */
  synthetic: 'search_memory' | 'remember' | 'handoff_to_agent' | null;
};

export type ToolResultContext = ToolExecuteContext & {
  result: string;
  ok: boolean;
  durationMs: number;
};

export type TurnStopContext = {
  run: RunMeta;
  reason: 'no_tool_calls' | 'needs_approval' | 'max_steps';
  steps: number;
  agent: HookAgent;
  /** El resultado que el loop está por devolver. */
  draft: AgentResult;
};

export type AgentHooks = {
  /** Corre al empezar cada vuelta. `{ stop: true }` corta el turno sin llamar al modelo. */
  beforeStep?(ctx: StepContext): Promise<{ stop: true; message?: string } | void>;
  /** Última chance de tocar lo que se le manda al modelo (tools, mensajes, presupuesto). */
  beforeModelRequest?(ctx: ModelRequestContext): Promise<{ request: ChatRequest } | void>;
  /**
   * Antes de ejecutar una tool. `{ skip: true, result }` la saltea y usa ese texto
   * como resultado (así se expresan las prohibiciones y los gates); `{ args }`
   * ejecuta con argumentos reescritos.
   */
  beforeToolExecute?(
    ctx: ToolExecuteContext,
  ): Promise<{ skip: true; result: string } | { args: Record<string, unknown> } | void>;
  /** Después de ejecutar. `{ result }` reescribe el texto que se persiste. */
  afterToolExecute?(ctx: ToolResultContext): Promise<{ result: string } | void>;
  /** Antes de cerrar el turno. `{ continue: true }` fuerza otra vuelta. */
  beforeTurnStop?(ctx: TurnStopContext): Promise<{ continue: true } | void>;
};

/** Sin interceptores: el objeto vacío. El loop comprueba cada hook antes de llamarlo. */
export const NO_HOOKS: AgentHooks = {};

/**
 * Composición explícita: corren en orden y el PRIMERO que devuelve un override
 * corta. No se mergean overrides a propósito — con dos hooks pisándose, "quién
 * ganó" se vuelve imposible de razonar, y estos hooks gobiernan permisos.
 */
export function mergeHooks(...hooks: AgentHooks[]): AgentHooks {
  const present = hooks.filter(Boolean);
  if (present.length === 0) return NO_HOOKS;
  if (present.length === 1) return present[0] as AgentHooks;

  const first =
    <K extends keyof AgentHooks>(name: K) =>
    async (ctx: never): Promise<unknown> => {
      for (const h of present) {
        const fn = h[name] as ((c: never) => Promise<unknown>) | undefined;
        if (!fn) continue;
        const out = await fn.call(h, ctx);
        if (out) return out;
      }
      return undefined;
    };

  const merged: AgentHooks = {};
  if (present.some((h) => h.beforeStep)) merged.beforeStep = first('beforeStep') as AgentHooks['beforeStep'];
  if (present.some((h) => h.beforeModelRequest)) {
    merged.beforeModelRequest = first('beforeModelRequest') as AgentHooks['beforeModelRequest'];
  }
  if (present.some((h) => h.beforeToolExecute)) {
    merged.beforeToolExecute = first('beforeToolExecute') as AgentHooks['beforeToolExecute'];
  }
  if (present.some((h) => h.afterToolExecute)) {
    merged.afterToolExecute = first('afterToolExecute') as AgentHooks['afterToolExecute'];
  }
  if (present.some((h) => h.beforeTurnStop)) {
    merged.beforeTurnStop = first('beforeTurnStop') as AgentHooks['beforeTurnStop'];
  }
  return merged;
}
