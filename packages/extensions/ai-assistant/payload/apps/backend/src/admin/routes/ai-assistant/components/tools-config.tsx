import { Badge, Button, Text } from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import {
  useToolsConfig,
  useSaveToolsConfig,
  type ToolMatrixEntry,
} from '../hooks';
import { ToolPermissionToggle } from './tool-permission-toggle';

type Mode = 'auto' | 'ask' | 'prohibited';
type ModeMap = Record<string, Mode>;

function key(tool: string, action: string, resource = '') {
  return `${tool}:${action}:${resource}`;
}

function buildModeMap(tools: ToolMatrixEntry[]): ModeMap {
  const map: ModeMap = {};
  for (const t of tools) {
    for (const a of t.actions) map[key(t.tool, a.action, t.resource ?? '')] = a.mode;
  }
  return map;
}

/** Una tool externa (mcp__servidor__tool) expone una sola "acción" sintética `*`. */
function isSingleAction(t: ToolMatrixEntry): boolean {
  return t.actions.length === 1 && t.actions[0]?.action === '*';
}

/** Nombre legible: para tools externas mostramos solo el tool (sin el prefijo mcp__). */
function displayLabel(t: ToolMatrixEntry): string {
  if (t.tool.startsWith('mcp__')) {
    const bare = t.tool.split('__').slice(2).join('__');
    return bare || t.label || t.tool;
  }
  return t.label ?? t.tool;
}

/**
 * Matriz de políticas (Automático / Consulta / Prohibido) de un subconjunto de
 * tools. El `filter` decide qué tools entran (las internas de Medusa, o las de un
 * servidor MCP externo) — así se reusa en el drawer de cada "MCP" en Configuración.
 * Guarda solo las policies de las tools mostradas; el backend hace upsert/borra
 * las que igualan el default.
 */
export const ToolPolicyMatrix = ({
  filter,
  emptyHint,
}: {
  filter: (t: ToolMatrixEntry) => boolean;
  emptyHint?: string;
}) => {
  const { data, isLoading } = useToolsConfig();
  const save = useSaveToolsConfig();
  const tools = useMemo(() => (data?.tools ?? []).filter(filter), [data, filter]);

  const [modes, setModes] = useState<ModeMap>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (tools.length) setModes(buildModeMap(tools));
  }, [data]);

  const dirty = useMemo(() => {
    const base = buildModeMap(tools);
    return Object.keys(modes).some((k) => modes[k] !== base[k]);
  }, [modes, tools]);

  const setMode = (tool: string, action: string, resource: string, mode: Mode) => {
    setModes((m) => ({ ...m, [key(tool, action, resource)]: mode }));
  };

  const applyPreset = (preset: 'safe' | 'all_auto') => {
    setModes((m) => {
      const next = { ...m };
      for (const t of tools) {
        for (const a of t.actions) {
          const k = key(t.tool, a.action, t.resource ?? '');
          next[k] = preset === 'all_auto' ? 'auto' : a.kind === 'read' ? 'auto' : 'ask';
        }
      }
      return next;
    });
  };

  const onSave = async () => {
    const policies = tools.flatMap((t) =>
      t.actions.map((a) => {
        const resource = t.resource ?? '';
        return {
          tool_name: t.tool,
          action: a.action,
          resource,
          mode: modes[key(t.tool, a.action, resource)] ?? a.mode,
        };
      }),
    );
    await save.mutateAsync(policies);
    setSavedAt(Date.now());
  };

  if (isLoading) {
    return <Text className="text-ui-fg-subtle txt-small">Cargando configuración de tools…</Text>;
  }

  if (!tools.length) {
    return (
      <Text className="text-ui-fg-subtle txt-small">
        {emptyHint ?? 'Este servidor todavía no expone tools. Probá / refrescá la conexión.'}
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="small" variant="secondary" onClick={() => applyPreset('safe')}>
            Preset seguro
          </Button>
          <Button size="small" variant="secondary" onClick={() => applyPreset('all_auto')}>
            Todo automático
          </Button>
        </div>
        <Button size="small" onClick={onSave} isLoading={save.isPending} disabled={!dirty}>
          Guardar
        </Button>
      </div>

      {savedAt && !dirty ? (
        <Text className="txt-small text-emerald-600">Configuración guardada.</Text>
      ) : null}

      <div className="flex flex-col gap-3">
        {tools.map((t) => {
          const single = isSingleAction(t);
          const resource = t.resource ?? '';
          return (
            <div
              key={key(t.tool, '', resource)}
              className="rounded-lg border border-ui-border-base bg-ui-bg-base p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="txt-compact-small-plus text-ui-fg-base">{displayLabel(t)}</p>
                    {!single ? (
                      <code className="txt-small text-ui-fg-muted">
                        {t.resource ? `${t.tool} · ${t.resource}` : t.tool}
                      </code>
                    ) : null}
                  </div>
                  {t.description ? (
                    <p className="txt-small text-ui-fg-subtle line-clamp-2">{t.description}</p>
                  ) : null}
                </div>
                {single && t.actions[0] ? (
                  <ToolPermissionToggle
                    label={displayLabel(t)}
                    value={modes[key(t.tool, '*', resource)] ?? t.actions[0].mode}
                    onChange={(mode) => setMode(t.tool, '*', resource, mode)}
                  />
                ) : null}
              </div>

              {!single ? (
                <div className="mt-3 flex flex-col gap-2">
                  {t.actions.map((a) => (
                    <div
                      key={a.action}
                      className="flex items-center justify-between gap-3 rounded-md border border-ui-border-base px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate txt-compact-small text-ui-fg-base">{a.action}</span>
                        <Badge size="2xsmall" color={a.kind === 'read' ? 'green' : 'orange'}>
                          {a.kind === 'read' ? 'lectura' : 'escritura'}
                        </Badge>
                      </div>
                      <ToolPermissionToggle
                        label={`${displayLabel(t)} · ${a.action}`}
                        value={modes[key(t.tool, a.action, resource)] ?? a.mode}
                        onChange={(mode) => setMode(t.tool, a.action, resource, mode)}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
