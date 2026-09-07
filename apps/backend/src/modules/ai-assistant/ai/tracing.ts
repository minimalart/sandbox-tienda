/**
 * Trazador de corridas del agente (observabilidad). Emite una fila `ai_agent_run`
 * por corrida y una `ai_agent_step` por paso (modelo / tool / handoff). Acumula
 * tokens y duración. TODA escritura es best-effort dentro de try/catch: la traza
 * NUNCA debe romper el turno del usuario ni el job.
 *
 * El run se crea de forma lazy en el primer paso, así un turno que sale sin llamar
 * al modelo (p. ej. al reanudar un hilo pendiente) no deja una fila vacía.
 */

export type RunKind = 'chat' | 'proactive' | 'proposal_exec';
export type RunStatus = 'running' | 'complete' | 'needs_approval' | 'error';

export type TraceStore = {
  createAgentRuns(data: any): Promise<any>;
  updateAgentRuns(data: any): Promise<any>;
  createAgentSteps(data: any): Promise<any>;
};

function now(): number {
  return Date.now();
}

export class RunTracer {
  private runId: string | null = null;
  private creating: Promise<void> | null = null;
  private idx = 0;
  private promptTokens = 0;
  private completionTokens = 0;
  private startedAt = now();
  private agentKey: string;
  private groundedness: any = null;
  private injectedMemoryIds: string[] | null = null;

  constructor(
    private store: TraceStore,
    private meta: {
      thread_id?: string | null;
      agent_key?: string;
      kind: RunKind;
      model?: string;
      created_by?: string;
    },
  ) {
    this.agentKey = meta.agent_key ?? 'general';
  }

  private async ensureRun(): Promise<void> {
    if (this.runId !== null) return;
    if (!this.creating) {
      this.creating = (async () => {
        try {
          const run = await this.store.createAgentRuns({
            thread_id: this.meta.thread_id ?? null,
            agent_key: this.agentKey,
            kind: this.meta.kind,
            status: 'running',
            model: this.meta.model ?? null,
            created_by: this.meta.created_by ?? null,
          });
          this.runId = run?.id ?? null;
        } catch {
          this.runId = null;
        }
      })();
    }
    await this.creating;
  }

  async modelStep(data: {
    agentKey?: string;
    model?: string;
    durationMs?: number;
    promptTokens?: number;
    completionTokens?: number;
    finishReason?: string | null;
  }): Promise<void> {
    if (data.agentKey) this.agentKey = data.agentKey;
    this.promptTokens += data.promptTokens ?? 0;
    this.completionTokens += data.completionTokens ?? 0;
    await this.step('model', {
      agentKey: data.agentKey,
      name: data.model ?? null,
      status: data.finishReason ?? 'ok',
      durationMs: data.durationMs,
      tokens: (data.promptTokens ?? 0) + (data.completionTokens ?? 0),
      detail: { finish_reason: data.finishReason ?? null },
    });
  }

  async toolStep(data: {
    agentKey?: string;
    name: string;
    handoff?: boolean;
    ok?: boolean;
    durationMs?: number;
    detail?: any;
  }): Promise<void> {
    await this.step(data.handoff ? 'handoff' : 'tool', {
      agentKey: data.agentKey,
      name: data.name,
      status: data.ok === false ? 'error' : 'ok',
      durationMs: data.durationMs,
      detail: data.detail ?? null,
    });
  }

  private async step(
    type: 'model' | 'tool' | 'handoff',
    data: {
      agentKey?: string;
      name?: string | null;
      status?: string | null;
      durationMs?: number;
      tokens?: number;
      detail?: any;
    },
  ): Promise<void> {
    try {
      await this.ensureRun();
      if (!this.runId) return;
      await this.store.createAgentSteps({
        run_id: this.runId,
        idx: this.idx++,
        type,
        agent_key: data.agentKey ?? this.agentKey ?? null,
        name: data.name ?? null,
        status: data.status ?? null,
        duration_ms: data.durationMs ?? null,
        tokens: data.tokens ?? null,
        detail: data.detail ?? null,
      });
    } catch {
      // best-effort: la traza nunca rompe el turno
    }
  }

  /** Veredicto de grounding del turno; se persiste en `finish`. Best-effort. */
  setGroundedness(verdict: any): void {
    this.groundedness = verdict ?? null;
  }

  /** IDs de memorias inyectadas en el system prompt; se persiste en `finish`. */
  setInjectedMemoryIds(ids: string[]): void {
    this.injectedMemoryIds = ids.length > 0 ? ids : null;
  }

  async finish(status: RunStatus, error?: string): Promise<void> {
    if (!this.runId) return;
    try {
      await this.store.updateAgentRuns({
        id: this.runId,
        status,
        steps: this.idx,
        prompt_tokens: this.promptTokens,
        completion_tokens: this.completionTokens,
        duration_ms: now() - this.startedAt,
        error: error ?? null,
        groundedness: this.groundedness,
        injected_memory_ids: this.injectedMemoryIds,
      });
    } catch {
      // best-effort
    }
  }
}
