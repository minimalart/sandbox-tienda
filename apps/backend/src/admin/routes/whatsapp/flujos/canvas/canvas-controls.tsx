import { ArrowsPointingOut, Map as MapIcon, Minus, Plus } from '@medusajs/icons';
import { IconButton, Tooltip } from '@medusajs/ui';
import { Panel, useReactFlow, useViewport } from '@xyflow/react';
import type { ReactElement } from 'react';

/**
 * Los controles del canvas: menos, el zoom en porcentaje, más, ajustar, y el
 * interruptor del minimapa.
 *
 * Reemplazan a los `<Controls />` de React Flow por dos motivos concretos: los de la
 * caja no muestran el zoom —y sin el número no se sabe si el recorrido está chico o
 * lejos— y traen un candado de "bloquear la interacción" que en este editor no
 * significa nada.
 */
export function CanvasControls({
  minimapOn,
  onToggleMinimap,
}: {
  minimapOn: boolean;
  onToggleMinimap: () => void;
}): ReactElement {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <Panel position="bottom-left">
      <div className="flex items-center gap-x-1 rounded-lg border bg-ui-bg-base p-1 shadow-elevation-card-rest">
        <IconButton size="small" variant="transparent" aria-label="Alejar" onClick={() => zoomOut({ duration: 120 })}>
          <Minus />
        </IconButton>
        {/* Tabular para que el ancho no salte entre 90% y 100% mientras se hace zoom. */}
        <span className="w-12 text-center text-ui-fg-subtle txt-compact-xsmall tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <IconButton size="small" variant="transparent" aria-label="Acercar" onClick={() => zoomIn({ duration: 120 })}>
          <Plus />
        </IconButton>
        <Tooltip content="Ajustar a la pantalla">
          <IconButton
            size="small"
            variant="transparent"
            aria-label="Ajustar a la pantalla"
            onClick={() => fitView({ duration: 300, padding: 0.15 })}
          >
            <ArrowsPointingOut />
          </IconButton>
        </Tooltip>
        <Tooltip content={minimapOn ? 'Ocultar el mapa' : 'Mostrar el mapa'}>
          <IconButton
            size="small"
            variant={minimapOn ? 'primary' : 'transparent'}
            aria-label="Mapa del recorrido"
            onClick={onToggleMinimap}
          >
            <MapIcon />
          </IconButton>
        </Tooltip>
      </div>
    </Panel>
  );
}
