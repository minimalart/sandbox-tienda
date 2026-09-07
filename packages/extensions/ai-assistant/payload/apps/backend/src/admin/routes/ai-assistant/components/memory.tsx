import {
  Badge,
  Button,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  StatusBadge,
  Text,
  Textarea,
} from '@medusajs/ui';
import { Check, EllipsisHorizontal, PencilSquare, Trash } from '@medusajs/icons';
import { useMemo, useState } from 'react';
import {
  ALL_MEMORY_TYPES,
  MEMORY_TYPE_LABELS,
  useAgents,
  useCreateMemory,
  useDeleteMemory,
  useMemories,
  useMemoryFeedback,
  useUpdateMemory,
  type Memory as MemoryRow,
  type CreateMemoryInput,
} from '../hooks';
import { ExtensionVersion } from '../../../components/common/extension-version';

const STATUS_TONE: Record<string, 'green' | 'orange' | 'grey'> = {
  active: 'green',
  pending: 'orange',
  archived: 'grey',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Activa',
  pending: 'Pendiente',
  archived: 'Archivada',
};

// @medusajs/ui (Radix) Select no admite value="" en un Item; usamos un sentinel
// para "memoria global" y lo mapeamos a '' (agent_key null) al guardar.
const GLOBAL_AGENT = '__global__';

type FormState = {
  id?: string;
  memory_type: string;
  agent_key: string; // '' = global
  title: string;
  content: string;
  summary: string;
  importance_score: number;
  tags: string;
};

const EMPTY_FORM: FormState = {
  memory_type: 'business_rule',
  agent_key: '',
  title: '',
  content: '',
  summary: '',
  importance_score: 50,
  tags: '',
};

export const Memory = () => {
  const [q, setQ] = useState('');
  const [agentKey, setAgentKey] = useState('');
  const [memoryType, setMemoryType] = useState('');
  const [status, setStatus] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState('');

  const filters = useMemo(
    () => ({
      q: q || undefined,
      agent_key: agentKey || undefined,
      memory_type: memoryType || undefined,
      status: status || undefined,
      limit: 100,
    }),
    [q, agentKey, memoryType, status],
  );

  const { data, isLoading } = useMemories(filters);
  const { data: agentsData } = useAgents();
  const createMemory = useCreateMemory();
  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();
  const feedback = useMemoryFeedback();

  const agents = agentsData?.agents ?? [];
  const memories = data?.memories ?? [];

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setError('');
    setDrawerOpen(true);
  };

  const openEdit = (m: MemoryRow) => {
    setForm({
      id: m.id,
      memory_type: m.memory_type,
      agent_key: m.agent_key ?? '',
      title: m.title,
      content: m.content,
      summary: m.summary ?? '',
      importance_score: m.importance_score,
      tags: (m.tags ?? []).join(', '),
    });
    setError('');
    setDrawerOpen(true);
  };

  const save = async () => {
    setError('');
    if (!form.title.trim() || !form.content.trim()) {
      setError('Título y contenido son obligatorios.');
      return;
    }
    const payload: CreateMemoryInput & { status?: string } = {
      memory_type: form.memory_type,
      title: form.title.trim(),
      content: form.content.trim(),
      summary: form.summary.trim() || null,
      agent_key: form.agent_key || null,
      importance_score: Number(form.importance_score) || 50,
      tags: form.tags.trim() ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : null,
    };
    try {
      if (form.id) await updateMemory.mutateAsync({ id: form.id, ...payload });
      else await createMemory.mutateAsync(payload);
      setDrawerOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const archive = (m: MemoryRow) => updateMemory.mutate({ id: m.id, status: 'archived' });
  const activate = (m: MemoryRow) => updateMemory.mutate({ id: m.id, status: 'active' });
  const remove = (m: MemoryRow) => {
    if (confirm(`¿Eliminar la memoria "${m.title}"?`)) deleteMemory.mutate(m.id);
  };

  const saving = createMemory.isPending || updateMemory.isPending;
  const pendingCount = memories.filter((m) => m.status === 'pending').length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading level="h1">Memoria</Heading>
          <ExtensionVersion extension="ai-assistant" />
        </div>
        <Button variant="secondary" size="small" onClick={openCreate}>
          Crear
        </Button>
      </div>

      <div className="flex flex-col gap-4 px-6 pb-6">
      {/* Toolbar de filtros */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label size="xsmall">Buscar</Label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Título o contenido…"
            className="w-64"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="xsmall">Agente</Label>
          <NativeSelect value={agentKey} onChange={setAgentKey}>
            <option value="">Todos</option>
            <option value="null">Global (toda la tienda)</option>
            {agents.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <Label size="xsmall">Tipo</Label>
          <NativeSelect value={memoryType} onChange={setMemoryType}>
            <option value="">Todos</option>
            {ALL_MEMORY_TYPES.map((t) => (
              <option key={t} value={t}>
                {MEMORY_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <Label size="xsmall">Estado</Label>
          <NativeSelect value={status} onChange={setStatus}>
            <option value="">Todos</option>
            <option value="active">Activas</option>
            <option value="pending">Pendientes</option>
            <option value="archived">Archivadas</option>
          </NativeSelect>
        </div>
      </div>

      {pendingCount > 0 && status !== 'pending' && (
        <button
          type="button"
          onClick={() => setStatus('pending')}
          className="self-start rounded-md bg-ui-tag-orange-bg px-2 py-1 text-left"
        >
          <Text size="small" className="text-ui-tag-orange-text">
            {pendingCount} memoria(s) pendiente(s) de aprobación — revisar
          </Text>
        </button>
      )}

      {/* Lista */}
      {isLoading ? (
        <Text className="text-ui-fg-subtle">Cargando…</Text>
      ) : memories.length === 0 ? (
        <Text className="text-ui-fg-subtle">No hay memorias con estos filtros.</Text>
      ) : (
        <div className="flex flex-col gap-2">
          {memories.map((m) => (
            <div key={m.id} className="rounded-lg border border-ui-border-base p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Text weight="plus" className="truncate">
                      {m.title}
                    </Text>
                    <StatusBadge color={STATUS_TONE[m.status] ?? 'grey'}>
                      {STATUS_LABEL[m.status] ?? m.status}
                    </StatusBadge>
                    <Badge size="2xsmall">{MEMORY_TYPE_LABELS[m.memory_type] ?? m.memory_type}</Badge>
                    {m.agent_key ? (
                      <Badge size="2xsmall" color="blue">
                        {m.agent_key}
                      </Badge>
                    ) : (
                      <Badge size="2xsmall" color="purple">
                        global
                      </Badge>
                    )}
                  </div>
                  <Text size="small" className="mt-1 line-clamp-2 text-ui-fg-subtle">
                    {m.summary || m.content}
                  </Text>
                  <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                    Importancia {m.importance_score} · usada {m.usage_count}×
                    {m.last_used_at ? ` · última ${new Date(m.last_used_at).toLocaleDateString()}` : ''}
                    {m.embedded_at ? '' : ' · (sin embedding aún)'}
                  </Text>
                </div>
                <div className="shrink-0">
                  <DropdownMenu>
                    <DropdownMenu.Trigger asChild>
                      <IconButton size="small" variant="transparent" aria-label="Acciones">
                        <EllipsisHorizontal />
                      </IconButton>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end" className="z-[60]">
                      {m.status === 'pending' && (
                        <DropdownMenu.Item className="gap-x-2" onClick={() => activate(m)}>
                          <Check className="text-ui-fg-subtle" />
                          Aprobar
                        </DropdownMenu.Item>
                      )}
                      <DropdownMenu.Item className="gap-x-2" onClick={() => openEdit(m)}>
                        <PencilSquare className="text-ui-fg-subtle" />
                        Editar
                      </DropdownMenu.Item>
                      {m.status === 'active' && (
                        <>
                          <DropdownMenu.Item
                            className="gap-x-2"
                            onClick={() => feedback.mutate({ id: m.id, useful: true })}
                          >
                            <span aria-hidden>👍</span>
                            Marcar como útil
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="gap-x-2"
                            onClick={() => feedback.mutate({ id: m.id, useful: false })}
                          >
                            <span aria-hidden>👎</span>
                            Marcar como no útil
                          </DropdownMenu.Item>
                        </>
                      )}
                      {m.status === 'archived' ? (
                        <DropdownMenu.Item className="gap-x-2" onClick={() => activate(m)}>
                          <Check className="text-ui-fg-subtle" />
                          Reactivar
                        </DropdownMenu.Item>
                      ) : (
                        <DropdownMenu.Item className="gap-x-2" onClick={() => archive(m)}>
                          Archivar
                        </DropdownMenu.Item>
                      )}
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item className="gap-x-2 text-ui-fg-error" onClick={() => remove(m)}>
                        <Trash className="text-ui-fg-error" />
                        Eliminar
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer crear/editar */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content className="z-50">
          <Drawer.Header>
            <Drawer.Title>{form.id ? 'Editar memoria' : 'Crear memoria'}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-3 overflow-y-auto">
            <div className="flex flex-col gap-1">
              <Label size="small">Tipo</Label>
              <Select value={form.memory_type} onValueChange={(v) => set('memory_type', v)}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content className="z-[60]">
                  {ALL_MEMORY_TYPES.filter((t) => t !== 'document_chunk').map((t) => (
                    <Select.Item key={t} value={t}>
                      {MEMORY_TYPE_LABELS[t] ?? t}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small">Agente (global = toda la tienda)</Label>
              <Select
                value={form.agent_key || GLOBAL_AGENT}
                onValueChange={(v) => set('agent_key', v === GLOBAL_AGENT ? '' : v)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content className="z-[60]">
                  <Select.Item value={GLOBAL_AGENT}>Global (toda la tienda)</Select.Item>
                  {agents.map((a) => (
                    <Select.Item key={a.key} value={a.key}>
                      {a.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small">Título</Label>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small">Contenido</Label>
              <Textarea
                rows={5}
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                placeholder="El aprendizaje, regla o decisión, autocontenido."
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small">Resumen (opcional, se inyecta al prompt si está)</Label>
              <Textarea rows={2} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <Label size="small">Importancia (0-100)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.importance_score}
                  onChange={(e) => set('importance_score', Number(e.target.value))}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label size="small">Tags (coma)</Label>
                <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} />
              </div>
            </div>
            {error && (
              <Text size="small" className="text-ui-fg-error">
                {error}
              </Text>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save} isLoading={saving}>
              {form.id ? 'Guardar' : 'Crear'}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
      </div>
    </>
  );
};

/** Select nativo estilado (para los filtros, fuera de Drawers). */
const NativeSelect = ({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="h-8 rounded-md border border-ui-border-base bg-ui-bg-field px-2 text-sm"
  >
    {children}
  </select>
);
