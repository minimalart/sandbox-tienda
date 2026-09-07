import { Badge, Button, Checkbox, Drawer, Heading, Input, Label, Select, Switch, Text, Textarea, usePrompt } from '@medusajs/ui';
import { SparklesSolid } from '@medusajs/icons';
import { useMemo, useState } from 'react';
import {
  useAgents,
  useSkills,
  useSaveAgent,
  useDeleteAgent,
  useDraftAgent,
  useToolsConfig,
  useMcpServers,
  useSaveSkill,
  useDeleteSkill,
  ALL_MEMORY_TYPES,
  MEMORY_TYPE_LABELS,
  type Agent,
  type AgentInput,
  type McpServer,
  type Skill,
} from '../hooks';
import { AgentAvatar } from './agent-avatar';
import { AgentDocuments } from './agent-documents';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { sdk } from '../../../lib/client';

const EFFORTS = ['default', 'minimal', 'low', 'medium', 'high'] as const;

type FormState = {
  key: string;
  name: string;
  description: string;
  instructions: string;
  avatarUrl: string;
  model: string;
  reasoning_effort: (typeof EFFORTS)[number];
  max_tokens: string;
  enabled: boolean;
  is_orchestrator: boolean;
  allTools: boolean;
  tools: string[];
  skills: string[];
  handoff_targets: string[];
  // [] = default (todos los tipos menos document_chunk); lista = esos tipos.
  memory_types: string[];
};

function toForm(a?: Agent): FormState {
  return {
    key: a?.key ?? '',
    name: a?.name ?? '',
    description: a?.description ?? '',
    instructions: a?.instructions ?? '',
    avatarUrl: a?.avatar_url ?? '',
    model: a?.model ?? '',
    reasoning_effort: a?.reasoning_effort ?? 'default',
    max_tokens: a?.max_tokens ? String(a.max_tokens) : '',
    enabled: a ? a.enabled : true,
    is_orchestrator: a?.is_orchestrator ?? false,
    allTools: a ? a.allowed_tools == null : false,
    tools: a?.allowed_tools?.map((t) => t.tool) ?? [],
    skills: a?.skills ?? [],
    handoff_targets: a?.handoff_targets ?? [],
    memory_types: a?.memory_types ?? [],
  };
}

/** Manifiesto completo de un agente existente (para toggles/ediciones parciales
 * sin perder el resto de sus datos al re-normalizar en el backend). */
function agentToInput(a: Agent): AgentInput {
  return {
    name: a.name,
    description: a.description,
    instructions: a.instructions,
    avatar_url: a.avatar_url,
    model: a.model,
    max_tokens: a.max_tokens,
    reasoning_effort: a.reasoning_effort,
    enabled: a.enabled,
    is_orchestrator: a.is_orchestrator,
    rank: a.rank,
    allowed_tools: a.allowed_tools,
    skills: a.skills ?? [],
    handoff_targets: a.handoff_targets ?? [],
    memory_types: a.memory_types ?? null,
  };
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Chevron a la derecha: afordancia de "abre el detalle" en filas clickeables. */
function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-ui-fg-muted">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Un grupo de tools (interno o un servidor MCP externo) con sus checkboxes. */
function ToolGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { tool: string; label: string }[];
  selected: string[];
  onToggle: (tool: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="txt-small font-medium text-ui-fg-subtle">{title}</p>
      {options.map((t) => (
        <label key={t.tool} className="flex items-center gap-2 txt-small">
          <Checkbox checked={selected.includes(t.tool)} onCheckedChange={() => onToggle(t.tool)} />
          {t.label} <code className="text-ui-fg-muted">{t.tool}</code>
        </label>
      ))}
    </div>
  );
}

/** Form de un skill (nombre + instrucciones). Se usa dentro de un nested drawer. */
const SkillForm = ({
  skill,
  onClose,
  onSaved,
  onDeleted,
}: {
  skill?: Skill;
  onClose: () => void;
  onSaved: (skill: Skill, isNew: boolean) => void;
  onDeleted: (skill: Skill) => void;
}) => {
  const save = useSaveSkill();
  const del = useDeleteSkill();
  const prompt = usePrompt();
  const [name, setName] = useState(skill?.name ?? '');
  const [instructions, setInstructions] = useState(skill?.instructions ?? '');
  const [enabled, setEnabled] = useState(skill ? skill.enabled : true);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    setError(null);
    try {
      const { skill: saved } = await save.mutateAsync({
        id: skill?.id,
        input: { key: skill?.key, name, instructions, enabled },
      });
      onSaved(saved, !skill);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onDelete = async () => {
    if (!skill) return;
    const confirmed = await prompt({
      title: 'Eliminar skill',
      description: `¿Eliminar el skill "${skill.name}"? Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    setError(null);
    try {
      await del.mutateAsync(skill.id);
      onDeleted(skill);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? <Text className="txt-small text-red-600">{error}</Text> : null}
      <div className="flex flex-col gap-1">
        <Label size="small">Nombre</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ventas y crecimiento" />
      </div>
      {skill ? (
        <Text className="txt-small text-ui-fg-muted">
          key: <code>{skill.key}</code>
        </Text>
      ) : null}
      <div className="flex flex-col gap-1">
        <Label size="small">Instrucciones del skill</Label>
        <Textarea
          rows={7}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Enfocá conversión, ticket promedio, recompra y tendencia. Distinguí crecimiento real de descuentos…"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={setEnabled} />
        <Label size="small">Habilitado</Label>
      </div>
      <div className="flex items-center justify-between gap-2">
        {skill ? (
          <Button
            variant="transparent"
            size="small"
            className="text-red-600"
            onClick={onDelete}
            isLoading={del.isPending}
          >
            Eliminar
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" size="small" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="small" onClick={onSave} isLoading={save.isPending} disabled={!name || !instructions}>
            {skill ? 'Guardar' : 'Crear skill'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const AgentForm = ({
  agent,
  agents,
  onClose,
}: {
  agent?: Agent;
  agents: Agent[];
  onClose: () => void;
}) => {
  const save = useSaveAgent();
  const draft = useDraftAgent();
  const { data: skillsData } = useSkills();
  const { data: toolsData } = useToolsConfig();
  const [form, setForm] = useState<FormState>(() => toForm(agent));
  const [genPrompt, setGenPrompt] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Nested drawer para crear/editar un skill sin salir del form del agente.
  const [skillEditing, setSkillEditing] = useState<Skill | 'new' | null>(null);
  // Nested drawer para describir el agente y generarlo con IA.
  const [genOpen, setGenOpen] = useState(false);
  // Nested drawer para ver el detalle de las tools de un MCP externo.
  const [mcpViewing, setMcpViewing] = useState<McpServer | null>(null);

  const skills = skillsData?.skills ?? [];
  const toolOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of toolsData?.tools ?? []) if (!map.has(t.tool)) map.set(t.tool, t.label ?? t.tool);
    return [...map.entries()].map(([tool, label]) => ({ tool, label }));
  }, [toolsData]);
  const { data: serversData } = useMcpServers();
  const internalTools = useMemo(
    () => toolOptions.filter((t) => !t.tool.startsWith('mcp__')),
    [toolOptions],
  );
  // Servidores MCP externos conectados (con tools): se muestran como una lista
  // clickeable en Avanzado; cada uno abre un drawer con el detalle de sus tools.
  const enabledServers = useMemo(
    () => (serversData?.servers ?? []).filter((s) => s.enabled && s.tools.length > 0),
    [serversData],
  );
  const otherAgents = agents.filter((a) => a.key !== agent?.key);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onGenerate = async () => {
    if (!genPrompt.trim() || draft.isPending) return;
    setError(null);
    try {
      const { draft: d } = await draft.mutateAsync(genPrompt.trim());
      setForm((f) => ({
        ...f,
        name: d.name || f.name,
        description: d.description || f.description,
        instructions: d.instructions || f.instructions,
      }));
      setGenOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const url = res.files?.[0]?.url;
      if (url) set('avatarUrl', url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    setError(null);
    const input: AgentInput = {
      name: form.name,
      key: agent ? agent.key : form.key || form.name,
      description: form.description || null,
      instructions: form.instructions,
      avatar_url: form.avatarUrl || null,
      model: form.model || null,
      reasoning_effort: form.reasoning_effort === 'default' ? null : form.reasoning_effort,
      max_tokens: form.max_tokens ? Number(form.max_tokens) : null,
      enabled: form.enabled,
      is_orchestrator: form.is_orchestrator,
      allowed_tools: form.allTools ? null : form.tools.map((tool) => ({ tool })),
      skills: form.skills,
      handoff_targets: form.handoff_targets,
      memory_types: form.memory_types.length ? form.memory_types : null,
    };
    try {
      await save.mutateAsync({ id: agent?.id, input });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const previewAgent = { key: agent?.key || form.key || form.name, name: form.name, avatar_url: form.avatarUrl };

  return (
    <div className="flex flex-col gap-5">
      {error ? <Text className="txt-small text-red-600">{error}</Text> : null}

      {/* Generar con IA (solo al crear): abre un drawer para describir el agente. */}
      {!agent ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
          <Text className="txt-small text-ui-fg-subtle">
            ¿No sabés por dónde empezar? Describilo y lo armo por vos.
          </Text>
          <Button variant="secondary" size="small" onClick={() => setGenOpen(true)} className="shrink-0">
            <SparklesSolid /> Generar con IA
          </Button>
        </div>
      ) : null}

      {/* Avatar + nombre + descripción */}
      <div className="flex items-start gap-4">
        <div className="flex w-20 shrink-0 flex-col items-center gap-2">
          <AgentAvatar agent={previewAgent} size={56} />
          <label className="inline-flex cursor-pointer">
            <Button variant="secondary" size="small" asChild>
              <span>{uploading ? 'Subiendo…' : form.avatarUrl ? 'Cambiar' : 'Subir foto'}</span>
            </Button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
          {form.avatarUrl ? (
            <button
              type="button"
              onClick={() => set('avatarUrl', '')}
              className="txt-small text-ui-fg-muted hover:text-ui-fg-base"
            >
              Quitar
            </button>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label size="small">Nombre</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ventas y crecimiento" />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">Descripción</Label>
            <Input
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Qué hace y cuándo conviene usarlo"
            />
          </div>
        </div>
      </div>

      {!agent ? (
        <div className="flex flex-col gap-1">
          <Label size="small">Key (slug, opcional — se deriva del nombre)</Label>
          <Input value={form.key} onChange={(e) => set('key', e.target.value)} placeholder="ventas" />
        </div>
      ) : (
        <Text className="txt-small text-ui-fg-muted">
          key: <code>{agent.key}</code> · origen: {agent.source}
        </Text>
      )}

      <div className="flex flex-col gap-1">
        <Label size="small">Instrucciones (system prompt del agente)</Label>
        <Textarea
          rows={6}
          value={form.instructions}
          onChange={(e) => set('instructions', e.target.value)}
          placeholder="Sos el agente de… Derivá a 'catalogo' si…"
        />
      </div>

      {/* Avanzado: lo técnico, colapsado por defecto. */}
      <div className="rounded-lg border border-ui-border-base">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left txt-compact-small-plus text-ui-fg-base"
        >
          <span className="text-ui-fg-subtle">Avanzado · modelo, tools, handoffs, orquestador</span>
          <Chevron open={advanced} />
        </button>

        {advanced ? (
          <div className="flex flex-col gap-4 border-t border-ui-border-base p-3">
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1">
                <Label size="small">Modelo (vacío = default)</Label>
                <Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="openai/gpt-5-mini" />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">Reasoning effort</Label>
                <Select value={form.reasoning_effort} onValueChange={(v) => set('reasoning_effort', v as FormState['reasoning_effort'])}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content className="z-[60]">
                    {EFFORTS.map((e) => (
                      <Select.Item key={e} value={e}>
                        {e}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">Max tokens (vacío = default)</Label>
                <Input value={form.max_tokens} onChange={(e) => set('max_tokens', e.target.value)} placeholder="6000" />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} />
                <Label size="small">Habilitado</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_orchestrator} onCheckedChange={(v) => set('is_orchestrator', v)} />
                <Label size="small">Orquestador</Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label size="small">Skills adjuntos</Label>
                <Button variant="transparent" size="small" onClick={() => setSkillEditing('new')}>
                  + Nuevo skill
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                {skills.length === 0 ? (
                  <Text className="txt-small text-ui-fg-muted">
                    Todavía no hay skills. Creá uno con “Nuevo skill”.
                  </Text>
                ) : null}
                {skills.map((s) => (
                  <div key={s.key} className="flex items-center gap-2 txt-small">
                    <span className="flex-1 text-ui-fg-base">
                      {s.name}
                      {!s.enabled ? <span className="ml-1.5 text-ui-fg-muted">(off)</span> : null}
                    </span>
                    <button
                      type="button"
                      className="text-ui-fg-muted hover:text-ui-fg-base"
                      onClick={() => setSkillEditing(s)}
                    >
                      editar
                    </button>
                    <Switch
                      checked={form.skills.includes(s.key)}
                      onCheckedChange={() => set('skills', toggle(form.skills, s.key))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* MCP externos: lista clickeable; cada uno abre un drawer con el
                detalle de sus tools (y, si el agente no tiene "todas", cuáles darle). */}
            {enabledServers.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label size="small">MCP externos</Label>
                <div className="flex flex-col gap-1.5">
                  {enabledServers.map((s) => {
                    const selected = s.tools.filter((t) => form.tools.includes(t.namespaced_name)).length;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setMcpViewing(s)}
                        className="flex items-center gap-2 rounded-md border border-ui-border-base bg-ui-bg-base px-2 py-1.5 text-left transition-colors hover:bg-ui-bg-base-hover"
                      >
                        <AgentAvatar agent={{ key: s.key, name: s.name, avatar_url: s.avatar_url }} size={22} />
                        <span className="flex-1 truncate txt-small text-ui-fg-base">{s.name}</span>
                        <span className="txt-small text-ui-fg-muted">
                          {form.allTools
                            ? `${s.tools.length} tools`
                            : `${selected}/${s.tools.length} tools`}
                        </span>
                        <ChevronRight />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label size="small">Puede derivar a (handoffs)</Label>
              <div className="flex flex-wrap gap-3">
                {otherAgents.map((a) => (
                  <label key={a.key} className="flex items-center gap-2 txt-small">
                    <Checkbox
                      checked={form.handoff_targets.includes(a.key)}
                      onCheckedChange={() => set('handoff_targets', toggle(form.handoff_targets, a.key))}
                    />
                    {a.name} <code className="text-ui-fg-muted">{a.key}</code>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label size="small">Tipos de memoria que usa (vacío = todos por default)</Label>
              <Text className="txt-small text-ui-fg-muted">
                Qué clase de memoria recupera este agente antes de responder. Los documentos que cargues
                abajo siempre se incluyen.
              </Text>
              <div className="flex flex-wrap gap-3">
                {ALL_MEMORY_TYPES.filter((t) => t !== 'document_chunk').map((t) => (
                  <label key={t} className="flex items-center gap-2 txt-small">
                    <Checkbox
                      checked={form.memory_types.includes(t)}
                      onCheckedChange={() => set('memory_types', toggle(form.memory_types, t))}
                    />
                    {MEMORY_TYPE_LABELS[t] ?? t}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Switch checked={form.allTools} onCheckedChange={(v) => set('allTools', v)} />
                <Label size="small">Acceso a todas las tools (menos las prohibidas globalmente)</Label>
              </div>
              {!form.allTools ? (
                <div className="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-md border border-ui-border-base p-2">
                  <ToolGroup
                    title="Medusa · interno"
                    options={internalTools}
                    selected={form.tools}
                    onToggle={(tool) => set('tools', toggle(form.tools, tool))}
                  />
                  <Text className="txt-small text-ui-fg-muted">
                    {enabledServers.length > 0
                      ? 'Las tools de MCP externos se habilitan arriba, en “MCP externos”.'
                      : 'Para sumar tools de terceros, agregá un servidor en Configuración → MCP externos.'}
                  </Text>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {agent?.id ? <AgentDocuments agentId={agent.id} /> : null}

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="small" onClick={onClose}>
          Cancelar
        </Button>
        <Button size="small" onClick={onSave} isLoading={save.isPending} disabled={!form.name || !form.instructions}>
          {agent ? 'Guardar' : 'Crear agente'}
        </Button>
      </div>

      {/* Nested drawer: describir el agente y generarlo con IA (precarga el form). */}
      <Drawer open={genOpen} onOpenChange={(o) => !o && setGenOpen(false)}>
        <Drawer.Content className="z-[60]">
          <Drawer.Header>
            <Drawer.Title>Generar agente con IA</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label size="small">Describí el agente y lo armo por vos</Label>
                <Textarea
                  rows={8}
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                  placeholder="Un agente que cuide la recompra y los clientes en riesgo: que detecte quién dejó de comprar, proponga acciones de retención y escriba con tono cercano…"
                />
                <Text className="txt-small text-ui-fg-muted">
                  Genero nombre, descripción e instrucciones a partir de tu descripción. Después podés ajustar todo.
                </Text>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" size="small" onClick={() => setGenOpen(false)}>
                  Cancelar
                </Button>
                <Button size="small" onClick={onGenerate} isLoading={draft.isPending} disabled={!genPrompt.trim()}>
                  Generar
                </Button>
              </div>
            </div>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>

      {/* Nested drawer: detalle de las tools de un MCP externo (y selección por
          agente cuando no tiene acceso a todas las tools). */}
      <Drawer open={mcpViewing !== null} onOpenChange={(o) => !o && setMcpViewing(null)}>
        <Drawer.Content className="z-[60]">
          <Drawer.Header>
            <Drawer.Title>{mcpViewing?.name ?? ''}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            {mcpViewing ? (
              <div className="flex flex-col gap-3">
                <Text className="txt-small text-ui-fg-muted">
                  Tools que expone <code>mcp__{mcpViewing.key}__…</code>
                  {form.allTools
                    ? ' · este agente tiene acceso a todas las tools.'
                    : ' · activá las que quieras darle a este agente.'}
                </Text>
                <div className="flex flex-col gap-2">
                  {mcpViewing.tools.map((t) => (
                    <label
                      key={t.namespaced_name}
                      className="flex items-start gap-2 rounded-md border border-ui-border-base p-2 txt-small"
                    >
                      {!form.allTools ? (
                        <Checkbox
                          className="mt-0.5"
                          checked={form.tools.includes(t.namespaced_name)}
                          onCheckedChange={() => set('tools', toggle(form.tools, t.namespaced_name))}
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="text-ui-fg-base">{t.name}</code>
                          {t.read_only_hint ? (
                            <Badge size="2xsmall" color="green">solo lectura</Badge>
                          ) : null}
                        </div>
                        {t.description ? (
                          <p className="mt-0.5 text-ui-fg-muted">{t.description}</p>
                        ) : null}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>

      {/* Nested drawer: crear/editar un skill sin salir del form del agente. */}
      <Drawer open={skillEditing !== null} onOpenChange={(o) => !o && setSkillEditing(null)}>
        <Drawer.Content className="z-[60]">
          <Drawer.Header>
            <Drawer.Title>
              {skillEditing === 'new' ? 'Nuevo skill' : `Editar ${skillEditing?.name ?? ''}`}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            {skillEditing !== null ? (
              <SkillForm
                skill={skillEditing === 'new' ? undefined : skillEditing}
                onClose={() => setSkillEditing(null)}
                onSaved={(s, isNew) => {
                  // Al crear, lo autoseleccionamos para este agente.
                  if (isNew) {
                    setForm((f) => ({
                      ...f,
                      skills: f.skills.includes(s.key) ? f.skills : [...f.skills, s.key],
                    }));
                  }
                  setSkillEditing(null);
                }}
                onDeleted={(s) => {
                  setForm((f) => ({ ...f, skills: f.skills.filter((k) => k !== s.key) }));
                  setSkillEditing(null);
                }}
              />
            ) : null}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </div>
  );
};

export const Agents = () => {
  const { data, isLoading } = useAgents();
  const del = useDeleteAgent();
  const toggleSave = useSaveAgent();
  const prompt = usePrompt();
  const [editing, setEditing] = useState<Agent | 'new' | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const agents = data?.agents ?? [];

  const agentsByKey = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents) m.set(a.key, a);
    return m;
  }, [agents]);

  const onToggleEnabled = async (a: Agent, enabled: boolean) => {
    setTogglingId(a.id);
    try {
      await toggleSave.mutateAsync({ id: a.id, input: { ...agentToInput(a), enabled } });
    } finally {
      setTogglingId(null);
    }
  };

  const onDelete = async (a: Agent) => {
    const confirmed = await prompt({
      title: 'Eliminar agente',
      description: `¿Eliminar el agente "${a.name}"? Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    await del.mutateAsync(a.id);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading level="h1">Agentes</Heading>
          <ExtensionVersion extension="ai-assistant" />
        </div>
        <Button variant="secondary" size="small" onClick={() => setEditing('new')}>
          Crear
        </Button>
      </div>

      <div className="flex flex-col gap-4 px-6 pb-6">
      {isLoading ? (
        <Text className="text-ui-fg-subtle">Cargando agentes…</Text>
      ) : agents.length === 0 ? (
        <Text className="text-ui-fg-subtle txt-small">
          No hay agentes. Corré <code>pnpm seed:ai-agents</code> o creá uno con “Nuevo agente”.
        </Text>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {agents.map((a) => {
            const handoffs = (a.handoff_targets ?? [])
              .map((k) => agentsByKey.get(k))
              .filter((t): t is Agent => Boolean(t));
            return (
              <div
                key={a.id}
                className="flex flex-col rounded-xl border border-ui-border-base bg-ui-bg-base p-4"
              >
                <div className="flex items-start gap-3">
                  <AgentAvatar agent={a} size={40} dimmed={!a.enabled} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="txt-compact-small-plus text-ui-fg-base">{a.name}</p>
                      <code className="txt-small text-ui-fg-muted">{a.key}</code>
                      {a.is_orchestrator ? <Badge size="2xsmall" color="blue">orquestador</Badge> : null}
                    </div>
                    {a.description ? (
                      <p className="mt-0.5 txt-small text-ui-fg-subtle">{a.description}</p>
                    ) : null}
                  </div>
                  <Switch
                    checked={a.enabled}
                    disabled={togglingId === a.id}
                    onCheckedChange={(v) => onToggleEnabled(a, v)}
                  />
                </div>

                {/* Derivaciones: el grafo de interacción, como avatares. */}
                <div className="mt-3 flex min-h-[20px] flex-wrap items-center gap-1.5 txt-small text-ui-fg-muted">
                  {handoffs.length > 0 ? (
                    <>
                      <span>deriva a</span>
                      {handoffs.map((t) => (
                        <span key={t.key} className="flex items-center gap-1" title={t.name}>
                          <AgentAvatar agent={t} size={18} />
                          <span className="text-ui-fg-subtle">{t.name}</span>
                        </span>
                      ))}
                    </>
                  ) : (
                    <span>no deriva</span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 txt-small text-ui-fg-muted">
                  <span>modelo: {a.model ?? 'default'}</span>
                  <span>skills: {a.skills?.join(', ') || '—'}</span>
                  <span>tools: {a.allowed_tools == null ? 'todas' : a.allowed_tools.length}</span>
                  <Badge size="2xsmall" color="grey">{a.source}</Badge>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button size="small" variant="secondary" onClick={() => setEditing(a)}>
                    Editar
                  </Button>
                  <Button
                    size="small"
                    variant="transparent"
                    className="text-red-600"
                    onClick={() => onDelete(a)}
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

      <Drawer open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <Drawer.Content className="z-[50]">
          <Drawer.Header>
            <Drawer.Title>{editing === 'new' ? 'Nuevo agente' : `Editar ${editing?.name ?? ''}`}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            {editing !== null ? (
              <AgentForm
                agent={editing === 'new' ? undefined : editing}
                agents={agents}
                onClose={() => setEditing(null)}
              />
            ) : null}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
      </div>
    </>
  );
};
