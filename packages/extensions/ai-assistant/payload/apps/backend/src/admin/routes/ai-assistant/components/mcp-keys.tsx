import { Button, Drawer, Heading, IconButton, Input, StatusBadge, Text } from '@medusajs/ui';
import { CheckCircleSolid, SquareTwoStack, Trash } from '@medusajs/icons';
import { useState } from 'react';
import { useCreateMcpKey, useMcpKeys, useRevokeMcpKey } from '../hooks';

function fmtDate(value: string | null): string {
  if (!value) return 'Nunca';
  try {
    return new Date(value).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * "Conectar con ChatGPT / Claude": un botón que abre un drawer con las dos formas
 * de enchufar este MCP a un cliente de IA — por OAuth (pegando la URL del conector)
 * o por API key (token para Claude Desktop / mcp-remote).
 */
export const ConnectClients = () => {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useMcpKeys();
  const create = useCreateMcpKey();
  const revoke = useRevokeMcpKey();
  const keys = data?.keys ?? [];

  const [name, setName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onCreate = async () => {
    if (!name.trim()) return;
    const res = await create.mutateAsync(name.trim());
    setNewToken(res.token);
    setName('');
    setCopied(false);
  };

  const copyToken = async () => {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
    } catch {
      /* noop */
    }
  };

  const connectorUrl = typeof window !== 'undefined' ? `${window.location.origin}/mcp` : '/mcp';

  const copyConnector = async () => {
    try {
      await navigator.clipboard.writeText(connectorUrl);
    } catch {
      /* noop */
    }
  };

  return (
    <>
      <Button variant="secondary" size="small" onClick={() => setOpen(true)}>
        Conectar con ChatGPT / Claude
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content className="z-[50]">
          <Drawer.Header>
            <Drawer.Title>Conectar con ChatGPT / Claude</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-6 overflow-y-auto">
            {/* Opción 1: conector por OAuth (claude.ai / ChatGPT) */}
            <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
              <Heading level="h2" className="text-ui-fg-base">
                Conector por OAuth (claude.ai / ChatGPT)
              </Heading>
              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-ui-border-base bg-ui-bg-subtle px-3 py-2 text-ui-fg-base">
                  {connectorUrl}
                </code>
                <IconButton onClick={copyConnector}>
                  <SquareTwoStack />
                </IconButton>
              </div>
            </div>

            {/* Opción 2: API key (Claude Desktop / mcp-remote) */}
            <div className="flex flex-col gap-4">
              <Heading level="h2" className="text-ui-fg-base">
                API Keys del MCP (Claude Desktop / mcp-remote)
              </Heading>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Text className="mb-1 txt-small text-ui-fg-subtle">Nombre (ej. Claude Desktop)</Text>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Claude Desktop"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onCreate();
                    }}
                  />
                </div>
                <Button onClick={onCreate} isLoading={create.isPending} disabled={!name.trim()}>
                  Generar key
                </Button>
              </div>

              {/* Token recién creado (se muestra una vez) */}
              {newToken ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <Text className="mb-2 txt-compact-small-plus text-emerald-800">
                    Copiá el token ahora — no se vuelve a mostrar:
                  </Text>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-md border border-emerald-200 bg-white px-3 py-2 text-ui-fg-base">
                      {newToken}
                    </code>
                    <IconButton onClick={copyToken} variant="primary">
                      {copied ? <CheckCircleSolid /> : <SquareTwoStack />}
                    </IconButton>
                  </div>
                </div>
              ) : null}

              {/* Lista */}
              {isLoading ? (
                <Text className="txt-small text-ui-fg-subtle">Cargando keys…</Text>
              ) : keys.length === 0 ? (
                <Text className="txt-small text-ui-fg-subtle">No hay API keys todavía.</Text>
              ) : (
                <div className="flex flex-col gap-2">
                  {keys.map((k) => (
                    <div
                      key={k.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2"
                    >
                      <div className="flex min-w-0 flex-col">
                        <div className="flex items-center gap-2">
                          <span className="truncate txt-compact-small-plus text-ui-fg-base">{k.name}</span>
                          {k.revoked ? (
                            <StatusBadge color="red">revocada</StatusBadge>
                          ) : (
                            <StatusBadge color="green">activa</StatusBadge>
                          )}
                        </div>
                        <span className="truncate txt-small text-ui-fg-subtle">
                          <code>{k.token_prefix}</code> · {k.request_count} req · último uso:{' '}
                          {fmtDate(k.last_used_at)}
                        </span>
                      </div>
                      {!k.revoked ? (
                        <IconButton
                          variant="transparent"
                          onClick={() => revoke.mutate(k.id)}
                          isLoading={revoke.isPending}
                        >
                          <Trash />
                        </IconButton>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </>
  );
};
