import { MagnifyingGlassMini, SidebarLeft } from '@medusajs/icons';
import { IconButton, Input, Text } from '@medusajs/ui';
import { useMemo, useState, type DragEvent, type ReactElement } from 'react';

import { TYPE_LABEL, type NodeType } from '../_editor';
import { STEP_MIME } from '../canvas/dnd';
import { TypeIcon } from '../canvas/type-icon';
import { useIsDark } from '../canvas/use-is-dark';
import { filterLibrary, NODE_META } from '../lib/registry';
import { SKIN } from '../lib/skin';

/**
 * LA BIBLIOTECA DE PASOS.
 *
 * Era una lista plana de nueve botones con el nombre del tipo y nada más. Ahora está
 * agrupada —Inicio, Mensajes, Lógica, Acciones—, cada paso dice en una línea para qué
 * sirve, y se puede buscar: con nueve tipos alcanza mirar, pero el buscador es lo que
 * hace que alguien que entra por primera vez no tenga que probar uno por uno.
 *
 * Dos formas de agregar, porque sirven a dos momentos distintos: el CLIC lo pone en
 * el centro de lo que estás mirando —es lo que querés cuando estás ubicado— y
 * ARRASTRAR lo pone donde lo sueltes.
 */
export function StepLibrary({
  onAdd,
  onHide,
}: {
  onAdd: (type: NodeType) => void;
  onHide: () => void;
}): ReactElement {
  const [query, setQuery] = useState('');
  const grupos = useMemo(() => filterLibrary(query), [query]);
  // El MISMO cuadrado de color que en la tarjeta: es lo que hace que el paso que
  // elegís acá y el que aparece en el canvas se reconozcan como el mismo.
  const skins = SKIN[useIsDark() ? 'dark' : 'light'];

  const onDragStart = (event: DragEvent, type: NodeType) => {
    event.dataTransfer.setData(STEP_MIME, type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r">
      <div className="border-b p-3">
        <div className="mb-2 flex items-center justify-between">
          <Text size="xsmall" weight="plus">
            Pasos
          </Text>
          {/* La columna se puede guardar: en un recorrido de treinta pasos lo que
              escasea es ancho de canvas, y la biblioteca se usa un rato al principio
              y después casi nunca. Vuelve con el botón que queda flotando. */}
          <IconButton size="2xsmall" variant="transparent" aria-label="Ocultar los pasos" onClick={onHide}>
            <SidebarLeft />
          </IconButton>
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ui-fg-muted">
            <MagnifyingGlassMini />
          </span>
          <Input
            size="small"
            className="pl-7"
            placeholder="Buscar pasos…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {grupos.length === 0 && (
          <Text size="xsmall" className="p-2 text-ui-fg-subtle">
            No hay pasos que coincidan.
          </Text>
        )}

        {grupos.map((group) => (
          <div key={group.key} className="mb-3">
            <Text size="xsmall" className="px-2 pb-1 text-ui-fg-muted">
              {group.label.toUpperCase()}
            </Text>
            <div className="flex flex-col gap-y-1">
              {group.types.map((type) => (
                <button
                  key={type}
                  type="button"
                  draggable
                  onDragStart={(event) => onDragStart(event, type)}
                  onClick={() => onAdd(type)}
                  title={NODE_META[type].hint}
                  className="flex w-full cursor-grab items-start gap-x-2.5 rounded-md p-2 text-left hover:bg-ui-bg-base-hover active:cursor-grabbing"
                >
                  <TypeIcon type={type} background={skins[type].accent} color={skins[type].onAccent} />
                  <span className="min-w-0">
                    <Text size="xsmall" weight="plus">
                      {TYPE_LABEL[type]}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {NODE_META[type].hint}
                    </Text>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t p-3">
        <Text size="xsmall" className="text-ui-fg-muted">
          Tocá un paso para agregarlo donde estás mirando, o arrastralo al canvas.
        </Text>
      </div>
    </div>
  );
}
