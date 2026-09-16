import { Button, Select, Text } from '@medusajs/ui';
import type { ReactElement } from 'react';

import { describeDiff, diffGraphs } from '../lib/diff';
import type { CanvasMode } from '../lib/overlays';
import type { Graph } from '../_editor';

/**
 * LA BARRA DE MODOS.
 *
 * El mismo dibujo contesta tres preguntas y cambiar entre ellas tiene que costar un
 * clic: qué HACE el recorrido, qué CAMBIA respecto de lo que está atendiendo, y por
 * dónde PASA la gente de verdad. Tres pantallas separadas obligarían a cruzar a mano
 * tres versiones del mismo diagrama.
 *
 * Aparece sólo cuando hay algo que comparar o medir —o sea, cuando ya se publicó algo—
 * porque antes de eso los otros dos modos no tienen nada que decir.
 */
export function ModeBar({
  mode,
  onMode,
  graph,
  publishedGraph,
  analyticsDays,
  onAnalyticsDays,
  analyticsSummary,
}: {
  mode: CanvasMode;
  onMode: (mode: CanvasMode) => void;
  graph: Graph;
  publishedGraph: Graph | null;
  analyticsDays: number;
  onAnalyticsDays: (days: number) => void;
  analyticsSummary: string | null;
}): ReactElement | null {
  if (!publishedGraph) return null;

  const diff = diffGraphs(publishedGraph, graph);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
      <div className="flex items-center gap-x-1">
        <ModeButton current={mode} value="edit" onMode={onMode}>
          Editar
        </ModeButton>
        <ModeButton current={mode} value="compare" onMode={onMode}>
          Comparar con lo publicado
        </ModeButton>
        <ModeButton current={mode} value="metrics" onMode={onMode}>
          Métricas
        </ModeButton>
      </div>

      {mode === 'compare' && (
        <Text size="xsmall" className={diff.same ? 'text-ui-fg-subtle' : 'text-ui-fg-base'}>
          {describeDiff(diff)}
        </Text>
      )}

      {mode === 'metrics' && (
        <div className="flex items-center gap-x-2">
          {analyticsSummary && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              {analyticsSummary}
            </Text>
          )}
          <Select value={String(analyticsDays)} onValueChange={(v) => onAnalyticsDays(Number(v))}>
            <Select.Trigger className="w-36">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="7">Últimos 7 días</Select.Item>
              <Select.Item value="30">Últimos 30 días</Select.Item>
              <Select.Item value="90">Últimos 90 días</Select.Item>
            </Select.Content>
          </Select>
        </div>
      )}
    </div>
  );
}

function ModeButton({
  current,
  value,
  onMode,
  children,
}: {
  current: CanvasMode;
  value: CanvasMode;
  onMode: (mode: CanvasMode) => void;
  children: string;
}): ReactElement {
  return (
    <Button
      size="small"
      variant={current === value ? 'primary' : 'transparent'}
      onClick={() => onMode(value)}
    >
      {children}
    </Button>
  );
}
