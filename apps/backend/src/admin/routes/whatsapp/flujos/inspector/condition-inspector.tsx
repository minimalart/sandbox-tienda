import { Trash } from '@medusajs/icons';
import { Button, IconButton, Input, Text } from '@medusajs/ui';
import type { ReactElement } from 'react';

import { ConditionEditor } from './condition-editor';
import type { NodeInspectorProps } from './types';

/**
 * LAS SALIDAS DE LA BIFURCACIÓN.
 *
 * El nodo declara sus salidas —igual que una pregunta declara sus respuestas— y cada
 * una tiene su conector en la tarjeta. Antes las ramas vivían sólo en el `when` de
 * cada flecha, así que elegir un rombo mostraba nada más que el nombre: no había
 * ningún lugar donde sumar una rama, y la única forma era arrastrar una segunda
 * flecha desde el mismo vértice y descubrir después dónde se ponía la condición.
 */
export function ConditionInspector({
  branches,
  addBranch,
  patchBranch,
  removeBranch,
}: NodeInspectorProps): ReactElement {
  return (
    <div className="flex flex-col gap-y-2">
      <Text size="xsmall">Salidas</Text>
      <Text size="xsmall" className="text-ui-fg-subtle">
        Se evalúan en orden y se toma la PRIMERA que se cumple. La que no tiene condición es la
        salida por default: se toma cuando no se cumple ninguna otra.
      </Text>

      {branches.map((branch) => (
        <div key={branch.value} className="flex flex-col gap-y-2 rounded-md border p-2">
          <div className="flex items-center gap-x-1">
            <Input
              size="small"
              placeholder="nombre de la salida"
              value={branch.label}
              onChange={(e) => patchBranch(branch.value, { label: e.target.value })}
            />
            <IconButton
              size="small"
              variant="transparent"
              aria-label="Quitar esta salida"
              onClick={() => removeBranch(branch.value)}
            >
              <Trash />
            </IconButton>
          </div>
          <ConditionEditor
            value={branch.when}
            onChange={(when) => patchBranch(branch.value, { when })}
          />
        </div>
      ))}

      <Button size="small" variant="secondary" onClick={addBranch}>
        Agregar salida
      </Button>
      <Text size="xsmall" className="text-ui-fg-subtle">
        Cada salida tiene su conector en la tarjeta. Arrastrá desde ahí hasta el paso que sigue, o
        usá el + de la fila para crear el paso y conectarlo de una.
      </Text>
    </div>
  );
}
