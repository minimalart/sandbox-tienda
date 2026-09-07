import { Badge, Button, Drawer, Input, Label, Select, Switch, Text, usePrompt } from '@medusajs/ui';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useMcpServers,
  useSaveMcpServer,
  useDeleteMcpServer,
  useRefreshMcpServer,
  useStartMcpOAuth,
  useToolsConfig,
  type McpServer,
  type McpServerInput,
} from '../hooks';
import { AgentAvatar } from './agent-avatar';
import { SuggestedConnectors } from './suggested-connectors';
import { ToolPolicyMatrix } from './tools-config';
import { sdk } from '../../../lib/client';

const TRANSPORTS = ['http', 'sse'] as const;
const AUTH_TYPES = ['none', 'bearer', 'header', 'oauth'] as const;

const AUTH_LABEL: Record<(typeof AUTH_TYPES)[number], string> = {
  none: 'Sin auth',
  bearer: 'Bearer token',
  header: 'Header custom',
  oauth: 'OAuth',
};

const HEALTH: Record<McpServer['health'], { label: string; color: 'green' | 'red' | 'grey' }> = {
  ok: { label: 'conectado', color: 'green' },
  error: { label: 'error', color: 'red' },
  unknown: { label: 'sin probar', color: 'grey' },
};

type FormState = {
  key: string;
  name: string;
  url: string;
  avatar_url: string;
  transport: (typeof TRANSPORTS)[number];
  auth_type: (typeof AUTH_TYPES)[number];
  auth_header_name: string;
  secret: string;
  oauth_client_id: string;
  oauth_client_secret: string;
  oauth_scope: string;
  enabled: boolean;
};

function toForm(s?: McpServer, prefill?: Partial<FormState>): FormState {
  return {
    key: s?.key ?? '',
    name: s?.name ?? '',
    url: s?.url ?? '',
    avatar_url: s?.avatar_url ?? '',
    transport: s?.transport ?? 'http',
    auth_type: s?.auth_type ?? 'none',
    auth_header_name: s?.auth_header_name ?? '',
    secret: '',
    oauth_client_id: s?.oauth_client_id ?? '',
    oauth_client_secret: '',
    oauth_scope: s?.oauth_scope ?? '',
    enabled: s ? s.enabled : true,
    // Defaults de un conector sugerido (solo al crear): el usuario completa la URL.
    ...(s ? {} : prefill ?? {}),
  };
}

/** Input completo para toggles/ediciones parciales sin pisar el secreto guardado. */
function serverToInput(s: McpServer): McpServerInput {
  return {
    name: s.name,
    url: s.url,
    avatar_url: s.avatar_url,
    transport: s.transport,
    auth_type: s.auth_type,
    auth_header_name: s.auth_header_name,
    oauth_client_id: s.oauth_client_id,
    oauth_scope: s.oauth_scope,
    enabled: s.enabled,
  };
}

const ServerForm = ({
  server,
  prefill,
  onClose,
}: {
  server?: McpServer;
  prefill?: Partial<FormState>;
  onClose: () => void;
}) => {
  const save = useSaveMcpServer();
  const [form, setForm] = useState<FormState>(() => toForm(server, prefill));
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const url = res.files?.[0]?.url;
      if (url) set('avatar_url', url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    setError(null);
    const input: McpServerInput = {
      key: server ? server.key : form.key || form.name,
      name: form.name.trim(),
      url: form.url.trim(),
      avatar_url: form.avatar_url || null,
      transport: form.transport,
      auth_type: form.auth_type,
      auth_header_name: form.auth_header_name.trim() || null,
      secret: form.secret ? form.secret : undefined,
      oauth_client_id: form.oauth_client_id.trim() || null,
      oauth_client_secret: form.oauth_client_secret ? form.oauth_client_secret : undefined,
      oauth_scope: form.oauth_scope.trim() || null,
      enabled: form.enabled,
    };
    try {
      await save.mutateAsync({ id: server?.id, input });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const secretPlaceholder = server?.has_secret ? 'Configurado — dejá vacío para no cambiar' : 'Pegá el token';
  const previewServer = { key: server?.key || form.key || form.name, name: form.name, avatar_url: form.avatar_url };

  return (
    <div className="flex flex-col gap-4">
      {error ? <Text className="txt-small text-red-600">{error}</Text> : null}

      {/* Ícono + nombre + key */}
      <div className="flex items-start gap-4">
        <div className="flex w-20 shrink-0 flex-col items-center gap-2">
          <AgentAvatar agent={previewServer} size={56} />
          <label className="inline-flex cursor-pointer">
            <Button variant="secondary" size="small" asChild>
              <span>{uploading ? 'Subiendo…' : form.avatar_url ? 'Cambiar' : 'Subir ícono'}</span>
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
          {form.avatar_url ? (
            <button
              type="button"
              onClick={() => set('avatar_url', '')}
              className="txt-small text-ui-fg-muted hover:text-ui-fg-base"
            >
              Quitar
            </button>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label size="small">Nombre</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Slack, GitHub, mi-mcp…" />
          </div>
          {!server ? (
            <div className="flex flex-col gap-1">
              <Label size="small">Key (slug, opcional — se deriva del nombre)</Label>
              <Input value={form.key} onChange={(e) => set('key', e.target.value)} placeholder="slack" />
            </div>
          ) : (
            <Text className="txt-small text-ui-fg-muted">
              key: <code>{server.key}</code> · las tools se exponen como <code>mcp__{server.key}__…</code>
            </Text>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label size="small">URL del servidor MCP</Label>
        <Input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://mi-mcp.com/mcp" />
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <Label size="small">Transporte</Label>
          <Select value={form.transport} onValueChange={(v) => set('transport', v as FormState['transport'])}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content className="z-[60]">
              {TRANSPORTS.map((t) => (
                <Select.Item key={t} value={t}>
                  {t === 'http' ? 'HTTP (Streamable)' : 'SSE'}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Autenticación</Label>
          <Select value={form.auth_type} onValueChange={(v) => set('auth_type', v as FormState['auth_type'])}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content className="z-[60]">
              {AUTH_TYPES.map((t) => (
                <Select.Item key={t} value={t}>
                  {AUTH_LABEL[t]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </div>

      {form.auth_type === 'header' ? (
        <div className="flex flex-col gap-1">
          <Label size="small">Nombre del header</Label>
          <Input value={form.auth_header_name} onChange={(e) => set('auth_header_name', e.target.value)} placeholder="X-API-Key" />
        </div>
      ) : null}

      {form.auth_type === 'bearer' || form.auth_type === 'header' ? (
        <div className="flex flex-col gap-1">
          <Label size="small">Token / clave</Label>
          <Input type="password" value={form.secret} onChange={(e) => set('secret', e.target.value)} placeholder={secretPlaceholder} />
          <Text className="txt-small text-ui-fg-muted">Se guarda cifrado (AES-256-GCM); nunca se vuelve a mostrar.</Text>
        </div>
      ) : null}

      {form.auth_type === 'oauth' ? (
        <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
          <Text className="txt-small text-ui-fg-subtle">
            Guardá el servidor y después tocá <strong>Conectar</strong> en la lista para autorizar. Si el
            servidor no soporta registro dinámico (DCR), cargá el client_id (y client_secret) acá.
          </Text>
          <div className="flex flex-col gap-1">
            <Label size="small">client_id (opcional)</Label>
            <Input value={form.oauth_client_id} onChange={(e) => set('oauth_client_id', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">client_secret (opcional)</Label>
            <Input type="password" value={form.oauth_client_secret} onChange={(e) => set('oauth_client_secret', e.target.value)} placeholder={server?.auth_type === 'oauth' ? 'Dejá vacío para no cambiar' : ''} />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">scope (opcional)</Label>
            <Input value={form.oauth_scope} onChange={(e) => set('oauth_scope', e.target.value)} placeholder="read write" />
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Switch checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} />
        <Label size="small">Habilitado</Label>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="small" onClick={onClose}>
          Cancelar
        </Button>
        <Button size="small" onClick={onSave} isLoading={save.isPending} disabled={!form.name || !form.url}>
          {server ? 'Guardar' : 'Agregar servidor'}
        </Button>
      </div>
    </div>
  );
};

/** Handle imperativo para disparar "Agregar servidor" desde afuera (header de la página). */
export type McpServersHandle = { openNew: () => void };

export const McpServers = forwardRef<McpServersHandle>((_props, ref) => {
  const { data, isLoading } = useMcpServers();
  const qc = useQueryClient();
  const del = useDeleteMcpServer();
  const prompt = usePrompt();
  const refresh = useRefreshMcpServer();
  const startOAuth = useStartMcpOAuth();
  const toggleSave = useSaveMcpServer();

  const [editing, setEditing] = useState<McpServer | 'new' | null>(null);
  const [prefill, setPrefill] = useState<Partial<FormState> | null>(null);
  // Drawer de políticas de tools (Automático/Consulta/Prohibido) por "MCP":
  // Medusa (tools internas, integrado) o un servidor externo puntual.
  const [toolsTarget, setToolsTarget] = useState<
    { kind: 'medusa' } | { kind: 'server'; server: McpServer } | null
  >(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cantidad de tools internas (de Medusa) para mostrar en su tarjeta integrada.
  const { data: toolsData } = useToolsConfig();
  const medusaToolCount = useMemo(
    () =>
      new Set(
        (toolsData?.tools ?? [])
          .filter((t) => !t.tool.startsWith('mcp__'))
          .map((t) => t.tool),
      ).size,
    [toolsData],
  );

  const openNew = (pf: Partial<FormState> | null) => {
    setPrefill(pf);
    setEditing('new');
  };
  useImperativeHandle(ref, () => ({ openNew: () => openNew(null) }), []);
  const closeForm = () => {
    setEditing(null);
    setPrefill(null);
  };

  const servers = useMemo(() => data?.servers ?? [], [data]);

  // El callback OAuth (pestaña/popup) avisa por postMessage; refrescamos la lista.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'mcp-oauth') qc.invalidateQueries({ queryKey: ['ai-mcp-servers'] });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [qc]);

  const onToggle = async (s: McpServer, enabled: boolean) => {
    setBusyId(s.id);
    try {
      await toggleSave.mutateAsync({ id: s.id, input: { ...serverToInput(s), enabled } });
    } finally {
      setBusyId(null);
    }
  };

  const onRefresh = async (s: McpServer) => {
    setError(null);
    setBusyId(s.id);
    try {
      const res = await refresh.mutateAsync(s.id);
      if (!res.ok) setError(`No se pudo conectar a “${s.name}”: ${res.error ?? 'error desconocido'}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const onConnect = async (s: McpServer) => {
    setError(null);
    try {
      const { authorization_url } = await startOAuth.mutateAsync(s.id);
      window.open(authorization_url, 'mcp-oauth', 'width=620,height=760');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SuggestedConnectors />

      <div className="border-t border-ui-border-base" />

      {error ? <Text className="txt-small text-red-600">{error}</Text> : null}

      <div className="flex flex-col gap-3">
        {/* Medusa: el MCP integrado de la tienda. No es eliminable; "Configurar
            tools" abre la matriz de políticas (Automático / Consulta / Prohibido). */}
        <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4">
          <div className="flex items-start gap-3">
            <AgentAvatar
              agent={{
                key: 'medusa',
                name: 'Medusa',
                avatar_url:
                  'https://mercatto.nyc3.digitaloceanspaces.com/62591822-01KWA94RYMY0C5491QRDACANVC.jpg',
              }}
              size={36}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="txt-compact-small-plus text-ui-fg-base">Medusa</p>
                <Badge size="2xsmall" color="green">conectado</Badge>
                <Badge size="2xsmall" color="grey">integrado</Badge>
              </div>
              <p className="mt-0.5 txt-small text-ui-fg-muted">
                Tools nativas de la tienda: productos, órdenes, clientes, promociones y más.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 txt-small text-ui-fg-muted">
            <span>{medusaToolCount} tools</span>
            <span>transporte: integrado</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="small" variant="secondary" onClick={() => setToolsTarget({ kind: 'medusa' })}>
              Configurar tools
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Text className="text-ui-fg-subtle txt-small">Cargando servidores…</Text>
        ) : servers.length === 0 ? (
          <Text className="text-ui-fg-subtle txt-small">
            Todavía no agregaste servidores MCP de terceros. Sumá uno con “Agregar servidor”.
          </Text>
        ) : (
          servers.map((s) => {
            const health = HEALTH[s.health];
            const needsConnect = s.auth_type === 'oauth' && !s.oauth_connected;
            return (
              <div key={s.id} className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4">
                <div className="flex items-start gap-3">
                  <AgentAvatar agent={{ key: s.key, name: s.name, avatar_url: s.avatar_url }} size={36} dimmed={!s.enabled} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="txt-compact-small-plus text-ui-fg-base">{s.name}</p>
                      <Badge size="2xsmall" color={health.color}>{health.label}</Badge>
                      <Badge size="2xsmall" color="grey">{AUTH_LABEL[s.auth_type]}</Badge>
                      {needsConnect ? <Badge size="2xsmall" color="orange">requiere conectar</Badge> : null}
                    </div>
                    <p className="mt-0.5 truncate txt-small text-ui-fg-muted" title={s.url}>
                      {s.url}
                    </p>
                  </div>
                  <Switch checked={s.enabled} disabled={busyId === s.id} onCheckedChange={(v) => onToggle(s, v)} />
                </div>

                {s.last_error && s.health === 'error' ? (
                  <p className="mt-2 txt-small text-red-600">{s.last_error}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 txt-small text-ui-fg-muted">
                  <span>{s.tools_count} {s.tools_count === 1 ? 'tool' : 'tools'}</span>
                  <span>transporte: {s.transport}</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => setToolsTarget({ kind: 'server', server: s })}
                  >
                    Configurar tools
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => onRefresh(s)}
                    isLoading={busyId === s.id && refresh.isPending}
                  >
                    Probar / refrescar
                  </Button>
                  {s.auth_type === 'oauth' ? (
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => onConnect(s)}
                      isLoading={startOAuth.isPending}
                    >
                      {s.oauth_connected ? 'Reconectar' : 'Conectar'}
                    </Button>
                  ) : null}
                  <Button size="small" variant="secondary" onClick={() => setEditing(s)}>
                    Editar
                  </Button>
                  <Button
                    size="small"
                    variant="transparent"
                    className="text-red-600"
                    onClick={async () => {
                      const confirmed = await prompt({
                        title: 'Eliminar servidor MCP',
                        description: `¿Eliminar "${s.name}"? Esta acción no se puede deshacer.`,
                        variant: 'danger',
                        confirmText: 'Confirmar',
                        cancelText: 'Cancelar',
                      });
                      if (confirmed) del.mutate(s.id);
                    }}
                    isLoading={del.isPending}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Drawer open={editing !== null} onOpenChange={(o) => !o && closeForm()}>
        <Drawer.Content className="z-[50]">
          <Drawer.Header>
            <Drawer.Title>{editing === 'new' ? 'Nuevo servidor MCP' : `Editar ${editing?.name ?? ''}`}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            {editing !== null ? (
              <ServerForm
                server={editing === 'new' ? undefined : editing}
                prefill={editing === 'new' ? prefill ?? undefined : undefined}
                onClose={closeForm}
              />
            ) : null}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>

      {/* Políticas de tools del MCP elegido: Medusa (internas) o un externo. */}
      <Drawer open={toolsTarget !== null} onOpenChange={(o) => !o && setToolsTarget(null)}>
        <Drawer.Content className="z-[50]">
          <Drawer.Header>
            <Drawer.Title>
              {toolsTarget?.kind === 'server' ? toolsTarget.server.name : 'Medusa'} · tools
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            {toolsTarget ? (
              <ToolPolicyMatrix
                key={toolsTarget.kind === 'medusa' ? 'medusa' : toolsTarget.server.key}
                filter={
                  toolsTarget.kind === 'medusa'
                    ? (t) => !t.tool.startsWith('mcp__')
                    : (t) => t.tool.startsWith(`mcp__${toolsTarget.server.key}__`)
                }
              />
            ) : null}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </div>
  );
});
McpServers.displayName = 'McpServers';
