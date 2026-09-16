import { DropdownMenu, IconButton } from '@medusajs/ui';
import { Plus } from '@medusajs/icons';
import type { ReactElement } from 'react';

import { TYPE_LABEL, type NodeType } from '../_editor';
import { GROUP_LABEL, LIBRARY_GROUPS } from '../lib/registry';

/**
 * El "+" que agrega un paso sin salir del lugar donde hace falta.
 *
 * Es el cambio que más baja la fricción para alguien que no es técnico: agregar un
 * paso entre otros dos era agregarlo suelto en la grilla, encontrarlo en el canvas,
 * borrar la flecha vieja y dibujar dos nuevas. Ahora es un clic sobre la flecha.
 *
 * La lista se recorta a los tipos que TIENEN SENTIDO en ese lugar (`allowed`): un
 * "Fin" en el medio de una flecha cortaría el recorrido, y ofrecerlo para después
 * rechazarlo es peor que no ofrecerlo.
 */
export function QuickInsertMenu({
  allowed,
  onPick,
  label,
  size = 'small',
}: {
  allowed: readonly NodeType[];
  onPick: (type: NodeType) => void;
  label: string;
  size?: 'small' | 'xsmall' | 'base';
}): ReactElement {
  const grupos = LIBRARY_GROUPS.map((g) => ({
    ...g,
    types: g.types.filter((t) => allowed.includes(t)),
  })).filter((g) => g.types.length > 0);

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton size={size} variant="primary" aria-label={label} title={label}>
          <Plus />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="center">
        {grupos.map((group, index) => (
          <div key={group.key}>
            {index > 0 && <DropdownMenu.Separator />}
            <DropdownMenu.Label>{GROUP_LABEL[group.key]}</DropdownMenu.Label>
            {group.types.map((type) => (
              <DropdownMenu.Item key={type} onClick={() => onPick(type)}>
                {TYPE_LABEL[type]}
              </DropdownMenu.Item>
            ))}
          </div>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
