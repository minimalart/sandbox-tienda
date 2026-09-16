import { Button, Select, Text } from '@medusajs/ui';
import type { ReactElement } from 'react';

import { branchesOf, optionsOf, TYPE_LABEL, type GraphEdge, type GraphNode } from '../_editor';
import { ConditionEditor } from './condition-editor';

/**
 * EL PANEL DE UNA FLECHA.
 *
 * Con un conector por salida, este panel dejó de ser el único lugar donde se podía
 * decir de qué opción sale una flecha — ahora eso se ve en el canvas. Queda para dos
 * cosas: la condición de las flechas del formato viejo, y RE-ATAR una flecha que
 * quedó apuntando a una salida que ya no existe, que antes no había forma de arreglar
 * sin borrarla y dibujarla de nuevo.
 */
export function EdgeInspector({
  edge,
  source,
  target,
  patch,
  onRemove,
  problems,
}: {
  edge: GraphEdge;
  source: GraphNode | null;
  target: GraphNode | null;
  patch: (patch: Partial<GraphEdge>) => void;
  onRemove: () => void;
  problems: string[];
}): ReactElement {
  const ramas = branchesOf(source);
  const opciones = optionsOf(source);
  const salidas = ramas.length
    ? ramas.map((b) => ({ value: b.value, label: b.label || b.value }))
    : opciones.map((o) => ({ value: o.value, label: o.label || o.value }));
  const huerfana = Boolean(edge.on) && !salidas.some((s) => s.value === edge.on);

  return (
    <div className="flex flex-col gap-y-4">
      <div>
        <Text size="small" weight="plus">
          Conexión
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {source ? TYPE_LABEL[source.type] : '—'} → {target ? TYPE_LABEL[target.type] : '—'}
        </Text>
      </div>

      {problems.length > 0 && (
        <div className="flex flex-col gap-y-1 rounded-md border border-ui-border-error bg-ui-bg-subtle p-2">
          {problems.map((problem, i) => (
            <Text key={i} size="xsmall" className="text-ui-fg-error">
              {problem}
            </Text>
          ))}
        </div>
      )}

      {huerfana && (
        <div className="flex flex-col gap-y-1 rounded-md border border-ui-border-error bg-ui-bg-subtle p-2">
          <Text size="xsmall" className="text-ui-fg-error">
            Esta flecha sale de “{edge.on}”, que ya no existe en el paso de origen.
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Elegí de dónde tiene que salir, o borrala.
          </Text>
        </div>
      )}

      {salidas.length > 0 ? (
        <label className="flex flex-col gap-y-1">
          <Text size="xsmall">{ramas.length ? 'Es la salida' : 'Se toma cuando el cliente elige'}</Text>
          <Select value={edge.on ?? ''} onValueChange={(value) => patch({ on: value })}>
            <Select.Trigger>
              <Select.Value placeholder={ramas.length ? 'Elegí una salida' : 'Elegí una respuesta'} />
            </Select.Trigger>
            <Select.Content>
              {salidas.map((salida) => (
                <Select.Item key={salida.value} value={salida.value}>
                  {salida.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          {ramas.length > 0 && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              La condición de esta rama se edita en la bifurcación, tocando el rombo.
            </Text>
          )}
          {!ramas.length && source?.optionsFrom && !edge.on && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Sin respuesta elegida, esta es la salida de lo que llega en vivo. Es la que el motor
              exige para que lo que el cliente elija de la lista dinámica lleve a algún lado.
            </Text>
          )}
        </label>
      ) : (
        <div className="flex flex-col gap-y-2">
          <Text size="xsmall">Condición</Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Una bifurcación necesita condición en todas sus salidas MENOS una.
          </Text>
          <ConditionEditor value={edge.when} onChange={(when) => patch({ when })} />
        </div>
      )}

      <div className="border-t pt-3">
        <Button size="small" variant="transparent" className="text-ui-fg-error" onClick={onRemove}>
          Eliminar esta conexión
        </Button>
      </div>
    </div>
  );
}
