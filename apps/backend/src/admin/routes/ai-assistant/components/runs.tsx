import { Badge, Text } from '@medusajs/ui';
import { useState } from 'react';
import { useRuns, useRun, type AgentRun } from '../hooks';

type BadgeColor = 'grey' | 'orange' | 'blue' | 'green' | 'red';

const KIND_LABEL: Record<AgentRun['kind'], string> = {
  chat: 'Chat',
  proactive: 'Análisis',
  proposal_exec: 'Ejecución',
};

const STATUS_COLOR: Record<AgentRun['status'], BadgeColor> = {
  running: 'orange',
  complete: 'green',
  needs_approval: 'blue',
  error: 'red',
};

const STEP_COLOR: Record<string, BadgeColor> = {
  model: 'grey',
  tool: 'orange',
  handoff: 'blue',
};

const RunSteps = ({ id }: { id: string }) => {
  const { data, isLoading } = useRun(id);
  if (isLoading) return <Text className="txt-small text-ui-fg-subtle">Cargando pasos…</Text>;
  const steps = data?.steps ?? [];
  if (!steps.length) return <Text className="txt-small text-ui-fg-muted">Sin pasos.</Text>;
  return (
    <div className="mt-2 flex flex-col gap-1 border-t border-ui-border-base pt-2">
      {steps.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-2 txt-small">
          <Badge size="2xsmall" color={STEP_COLOR[s.type] ?? 'grey'}>
            {s.type}
          </Badge>
          <code className="text-ui-fg-muted">{s.name ?? '—'}</code>
          {s.status ? (
            <span className={s.status === 'error' ? 'text-red-600' : 'text-ui-fg-subtle'}>
              {s.status}
            </span>
          ) : null}
          {s.tokens ? <span className="text-ui-fg-muted">{s.tokens} tok</span> : null}
          {s.duration_ms != null ? <span className="text-ui-fg-muted">{s.duration_ms} ms</span> : null}
        </div>
      ))}
    </div>
  );
};

export const Runs = () => {
  const { data, isLoading } = useRuns();
  const [open, setOpen] = useState<string | null>(null);
  const runs = data?.runs ?? [];

  if (isLoading) return <Text className="text-ui-fg-subtle">Cargando logs…</Text>;
  if (!runs.length) {
    return (
      <Text className="text-ui-fg-subtle txt-small">
        No hay corridas registradas todavía. Usá el chat o generá una propuesta para ver logs.
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {runs.map((r) => (
        <div key={r.id} className="rounded-lg border border-ui-border-base bg-ui-bg-base p-3">
          <button
            type="button"
            className="flex w-full flex-wrap items-center gap-2 text-left"
            onClick={() => setOpen(open === r.id ? null : r.id)}
          >
            <Badge size="2xsmall" color={STATUS_COLOR[r.status] ?? 'grey'}>
              {r.status}
            </Badge>
            <code className="txt-small text-ui-fg-base">{r.agent_key}</code>
            <Badge size="2xsmall" color="grey">
              {KIND_LABEL[r.kind] ?? r.kind}
            </Badge>
            <span className="txt-small text-ui-fg-muted">{r.steps} pasos</span>
            <span className="txt-small text-ui-fg-muted">
              {r.prompt_tokens + r.completion_tokens} tok
            </span>
            {r.duration_ms != null ? (
              <span className="txt-small text-ui-fg-muted">{r.duration_ms} ms</span>
            ) : null}
            {r.model ? <span className="txt-small text-ui-fg-muted">{r.model}</span> : null}
            {r.groundedness ? (
              <Badge size="2xsmall" color={r.groundedness.grounded ? 'green' : 'red'}>
                {r.groundedness.grounded ? 'grounded' : 'sin respaldo'}
                {typeof r.groundedness.score === 'number'
                  ? ` ${Math.round(r.groundedness.score * 100)}%`
                  : ''}
              </Badge>
            ) : null}
          </button>
          {r.groundedness && !r.groundedness.grounded && r.groundedness.issues.length > 0 ? (
            <ul className="mt-1 list-disc pl-5 txt-small text-amber-700">
              {r.groundedness.issues.map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          ) : null}
          {r.error ? <Text className="txt-small text-red-600">{r.error}</Text> : null}
          {open === r.id ? <RunSteps id={r.id} /> : null}
        </div>
      ))}
    </div>
  );
};
