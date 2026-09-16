import { Button, Input, Text } from '@medusajs/ui';
import type { ReactElement } from 'react';

import { TYPE_LABEL } from '../_editor';
import { TypeIcon } from '../canvas/type-icon';
import { useIsDark } from '../canvas/use-is-dark';
import { NODE_META } from '../lib/registry';
import { SKIN } from '../lib/skin';
import { REGISTRY_UI } from './registry-ui';
import { TimeoutField } from './timeout-field';
import type { NodeInspectorProps } from './types';

/**
 * El panel del paso elegido: lo común arriba, el formulario del tipo en el medio, y
 * eliminar al pie.
 *
 * "Eliminar" dejó de ser un botón rojo grande arriba del formulario. Estaba al lado
 * de los campos que se editan todo el tiempo, y es la única acción de esta pantalla
 * que no se puede deshacer. Ahora vive al pie, apagado, y además está en el menú de
 * la tarjeta y en la tecla Delete.
 */
export function NodeInspector(
  props: NodeInspectorProps & { problems: string[]; onRemove: () => void },
): ReactElement {
  const { node, patch, problems } = props;
  const definition = REGISTRY_UI[node.type];
  const Inspector = definition.Inspector;
  const skin = SKIN[useIsDark() ? 'dark' : 'light'][node.type];

  return (
    <div className="flex flex-col gap-y-4">
      {/* El mismo cuadrado de color que en la tarjeta y en la biblioteca: el operador
          ve el mismo símbolo en los tres lugares donde se cruza con un tipo de paso. */}
      <div className="flex items-start gap-x-2.5">
        <TypeIcon type={node.type} background={skin.accent} color={skin.onAccent} />
        <div className="min-w-0">
          <Text size="small" weight="plus">
            {TYPE_LABEL[node.type]}
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            {NODE_META[node.type].hint}
          </Text>
        </div>
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

      <label className="flex flex-col gap-y-1">
        <Text size="xsmall">Nombre (sólo para vos)</Text>
        <Input size="small" value={node.label ?? ''} onChange={(e) => patch({ label: e.target.value })} />
      </label>

      <Inspector {...props} />

      {/* Va acá y no dentro del inspector de cada tipo: las tres preguntas lo
          comparten y es lo mismo en las tres, así que el formulario del tipo sigue
          hablando sólo de lo que hace único a ese tipo. */}
      <TimeoutField {...props} />

      <div className="border-t pt-3">
        <Button size="small" variant="transparent" className="text-ui-fg-error" onClick={props.onRemove}>
          Eliminar este paso
        </Button>
      </div>
    </div>
  );
}
