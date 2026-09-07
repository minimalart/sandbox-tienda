import { Badge, Button, Drawer, Heading, Input, Label, Select, Switch, Text, Textarea, usePrompt } from '@medusajs/ui';
import { useState } from 'react';
import {
  useWorkflows,
  useSaveWorkflow,
  useDeleteWorkflow,
  useAgents,
  type Agent,
  type WorkflowDefinition,
  type WorkflowInput,
  type WorkflowStep,
} from '../hooks';
import { AgentAvatar } from './agent-avatar';
import { ExtensionVersion } from '../../../components/common/extension-version';

/** Tile con glifo de "flujo" (dos nodos que convergen), análogo al avatar del agente. */
const WorkflowIcon = ({ dimmed }: { dimmed?: boolean }) => (
  <div
    aria-hidden
    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ui-bg-component text-ui-fg-subtle ${
      dimmed ? 'opacity-40' : ''
    }`}
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <path d="M8.5 7 L15.5 11" />
      <path d="M8.5 17 L15.5 13" />
    </svg>
  </div>
);

function workflowToInput(w: WorkflowDefinition): WorkflowInput {
  return {
    key: w.key,
    name: w.name,
    description: w.description,
    enabled: w.enabled,
    steps: w.steps,
    final_action: w.final_action,
  };
}

type StepForm = {
  key: string;
  agent_key: string;
  task: string;
  parallel_group: string;
  requires_approval: boolean;
};

type FormState = {
  name: string;
  description: string;
  enabled: boolean;
  confirmFinal: boolean;
  steps: StepForm[];
};

function toForm(w?: WorkflowDefinition): FormState {
  return {
    name: w?.name ?? '',
    description: w?.description ?? '',
    enabled: w ? w.enabled : true,
    confirmFinal: w?.final_action?.type === 'confirm',
    steps: (w?.steps ?? []).map((s) => ({
      key: s.key ?? '',
      agent_key: s.agent_key ?? '',
      task: s.task ?? '',
      parallel_group: s.parallel_group != null ? String(s.parallel_group) : '',
      requires_approval: Boolean(s.requires_approval),
    })),
  };
}

const emptyStep = (): StepForm => ({
  key: '',
  agent_key: '',
  task: '',
  parallel_group: '',
  requires_approval: false,
});

const WorkflowForm = ({
  workflow,
  agents,
  onClose,
}: {
  workflow?: WorkflowDefinition;
  agents: Agent[];
  onClose: () => void;
}) => {
  const save = useSaveWorkflow();
  const [form, setForm] = useState<FormState>(() => toForm(workflow));
  const [error, setError] = useState<string | null>(null);

  const setStep = (i: number, patch: Partial<StepForm>) =>
    setForm((f) => ({ ...f, steps: f.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const move = (i: number, dir: -1 | 1) =>
    setForm((f) => {
      const j = i + dir;
      if (j < 0 || j >= f.steps.length) return f;
      const steps = [...f.steps];
      [steps[i], steps[j]] = [steps[j]!, steps[i]!];
      return { ...f, steps };
    });

  const onSave = async () => {
    setError(null);
    const steps: WorkflowStep[] = form.steps.map((s, i) => ({
      key: (s.key.trim() || `paso-${i + 1}`).replace(/\s+/g, '-'),
      agent_key: s.agent_key,
      task: s.task.trim(),
      parallel_group: s.parallel_group.trim() || undefined,
      requires_approval: s.requires_approval || undefined,
    }));
    if (!form.name.trim()) return setError('El nombre es obligatorio.');
    if (steps.length === 0) return setError('Agregá al menos un paso.');
    if (steps.some((s) => !s.agent_key || !s.task)) {
      return setError('Cada paso necesita un agente y una tarea.');
    }
    try {
      await save.mutateAsync({
        id: workflow?.id,
        input: {
          key: workflow?.key,
          name: form.name.trim(),
          description: form.description.trim() || null,
          enabled: form.enabled,
          steps,
          final_action: { type: form.confirmFinal ? 'confirm' : 'none' },
        },
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? <Text className="txt-small text-red-600">{error}</Text> : null}

      <div className="flex flex-col gap-1">
        <Label size="small">Nombre</Label>
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Receta para el blog" />
      </div>
      {workflow ? (
        <Text className="txt-small text-ui-fg-muted">
          key: <code>{workflow.key}</code> · arrancalo desde el chat con <code>start_workflow</code>
        </Text>
      ) : null}
      <div className="flex flex-col gap-1">
        <Label size="small">Descripción (le dice al Orquestador cuándo usarlo)</Label>
        <Input
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Crea un borrador de receta en el blog: investiga, redacta, portada y productos."
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label size="small">Pasos (en orden; el motor los corre así)</Label>
          <Button variant="transparent" size="small" onClick={() => setForm((f) => ({ ...f, steps: [...f.steps, emptyStep()] }))}>
            + Paso
          </Button>
        </div>
        {form.steps.length === 0 ? (
          <Text className="txt-small text-ui-fg-muted">Sin pasos. Agregá uno con “+ Paso”.</Text>
        ) : null}
        {form.steps.map((s, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
            <div className="flex items-center gap-2">
              <span className="txt-compact-small-plus text-ui-fg-muted">{i + 1}.</span>
              <div className="w-[200px]">
                <Select value={s.agent_key} onValueChange={(v) => setStep(i, { agent_key: v })}>
                  <Select.Trigger>
                    <Select.Value placeholder="Subagente" />
                  </Select.Trigger>
                  <Select.Content className="z-[60]">
                    {agents.map((a) => (
                      <Select.Item key={a.key} value={a.key}>
                        {a.name} ({a.key})
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <Input
                className="w-[120px]"
                value={s.key}
                onChange={(e) => setStep(i, { key: e.target.value })}
                placeholder={`paso-${i + 1}`}
              />
              <div className="ml-auto flex items-center gap-1">
                <Button variant="transparent" size="small" disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                <Button variant="transparent" size="small" disabled={i === form.steps.length - 1} onClick={() => move(i, 1)}>↓</Button>
                <Button
                  variant="transparent"
                  size="small"
                  className="text-red-600"
                  onClick={() => setForm((f) => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }))}
                >
                  Quitar
                </Button>
              </div>
            </div>
            <Textarea
              rows={3}
              value={s.task}
              onChange={(e) => setStep(i, { task: e.target.value })}
              placeholder="Tarea para el subagente. Podés usar {{input.topic}} y {{state.<paso>.<campo>}}. Pedile cerrar con <result>{…}</result>."
            />
            <div className="flex flex-wrap items-center gap-3">
              <Input
                className="w-[160px]"
                value={s.parallel_group}
                onChange={(e) => setStep(i, { parallel_group: e.target.value })}
                placeholder="grupo paralelo (opc.)"
              />
              <label className="flex items-center gap-2 txt-small">
                <Switch checked={s.requires_approval} onCheckedChange={(v) => setStep(i, { requires_approval: v })} />
                Requiere aprobación
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 txt-small">
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
          Habilitado
        </label>
        <label className="flex items-center gap-2 txt-small">
          <Switch checked={form.confirmFinal} onCheckedChange={(v) => setForm((f) => ({ ...f, confirmFinal: v }))} />
          Pedir confirmación al final
        </label>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="small" onClick={onClose}>
          Cancelar
        </Button>
        <Button size="small" onClick={onSave} isLoading={save.isPending} disabled={!form.name.trim()}>
          {workflow ? 'Guardar' : 'Crear workflow'}
        </Button>
      </div>
    </div>
  );
};

export const Workflows = () => {
  const { data, isLoading } = useWorkflows();
  const { data: agentsData } = useAgents();
  const save = useSaveWorkflow();
  const del = useDeleteWorkflow();
  const prompt = usePrompt();
  const [editing, setEditing] = useState<WorkflowDefinition | 'new' | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const workflows = data?.workflows ?? [];
  const agents = (agentsData?.agents ?? []).filter((a) => !a.is_orchestrator);
  const agentsByKey = new Map(agents.map((a) => [a.key, a]));

  const onToggleEnabled = async (w: WorkflowDefinition, enabled: boolean) => {
    setTogglingId(w.id);
    try {
      await save.mutateAsync({ id: w.id, input: { ...workflowToInput(w), enabled } });
    } finally {
      setTogglingId(null);
    }
  };

  const onDelete = async (w: WorkflowDefinition) => {
    const ok = await prompt({
      title: 'Eliminar workflow',
      description: `¿Eliminar el workflow "${w.name}"? Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
    });
    if (ok) await del.mutateAsync(w.id);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading level="h1">Workflows</Heading>
          <ExtensionVersion extension="ai-assistant" />
        </div>
        <Button variant="secondary" size="small" onClick={() => setEditing('new')}>
          Crear
        </Button>
      </div>

      <div className="flex flex-col gap-4 px-6 pb-6">
        {isLoading ? (
          <Text className="text-ui-fg-subtle">Cargando workflows…</Text>
        ) : workflows.length === 0 ? (
          <Text className="text-ui-fg-subtle txt-small">
            No hay workflows. Creá uno con “Crear” o corré <code>pnpm seed:content-team</code>.
          </Text>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {workflows.map((w) => {
              const steps = w.steps ?? [];
              return (
                <div
                  key={w.id}
                  className="flex flex-col rounded-xl border border-ui-border-base bg-ui-bg-base p-4"
                >
                  <div className="flex items-start gap-3">
                    <WorkflowIcon dimmed={!w.enabled} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="txt-compact-small-plus text-ui-fg-base">{w.name}</p>
                        <code className="txt-small text-ui-fg-muted">{w.key}</code>
                      </div>
                      {w.description ? (
                        <p className="mt-0.5 txt-small text-ui-fg-subtle">{w.description}</p>
                      ) : null}
                    </div>
                    <Switch
                      checked={w.enabled}
                      disabled={togglingId === w.id}
                      onCheckedChange={(v) => onToggleEnabled(w, v)}
                    />
                  </div>

                  {/* Secuencia de pasos: el grafo de subagentes, como avatares. */}
                  <div className="mt-3 flex min-h-[20px] flex-wrap items-center gap-1.5 txt-small text-ui-fg-muted">
                    {steps.length > 0 ? (
                      steps.map((s, i) => {
                        const a = agentsByKey.get(s.agent_key);
                        return (
                          <span key={i} className="flex items-center gap-1" title={a?.name ?? s.agent_key}>
                            {i > 0 ? <span className="px-0.5 text-ui-fg-muted">→</span> : null}
                            {a ? <AgentAvatar agent={a} size={18} /> : null}
                            <span className="text-ui-fg-subtle">{a?.name ?? s.agent_key}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span>sin pasos</span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 txt-small text-ui-fg-muted">
                    <span>pasos: {steps.length}</span>
                    <span>acción final: {w.final_action?.type === 'confirm' ? 'confirmar' : '—'}</span>
                    <Badge size="2xsmall" color="grey">{w.source}</Badge>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Button size="small" variant="secondary" onClick={() => setEditing(w)}>
                      Editar
                    </Button>
                    <Button
                      size="small"
                      variant="transparent"
                      className="text-red-600"
                      onClick={() => onDelete(w)}
                      isLoading={del.isPending}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Drawer open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <Drawer.Content className="z-[50]">
          <Drawer.Header>
            <Drawer.Title>{editing === 'new' ? 'Nuevo workflow' : `Editar ${editing?.name ?? ''}`}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            {editing !== null ? (
              <WorkflowForm
                workflow={editing === 'new' ? undefined : editing}
                agents={agents}
                onClose={() => setEditing(null)}
              />
            ) : null}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </>
  );
};
