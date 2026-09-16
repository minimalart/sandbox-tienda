import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { memo, type ReactElement } from 'react';

import { INSERTABLE_TYPES } from '../_editor';
import type { WaEdgeData } from '../lib/to-canvas';
import { useEditorActions } from './editor-context';
import { QuickInsertMenu } from './quick-insert-menu';

/**
 * LA FLECHA.
 *
 * Dos cosas que no tenía:
 *
 * 1. SIGNIFICADO. Gris apagada en reposo, resaltada cuando toca al paso
 *    seleccionado, roja cuando es parte de un problema. Antes eran todas iguales,
 *    así que en un recorrido de treinta flechas no había forma de seguir una rama.
 * 2. EL "+" QUE INSERTA UN PASO EN EL MEDIO. Agregar un mensaje entre dos pasos era
 *    agregarlo suelto, borrar la flecha vieja y dibujar dos nuevas acordándose de
 *    volver a atarla a la opción que tenía.
 *
 * El chip y el "+" van en `EdgeLabelRenderer`, que los portalea fuera del `<svg>`:
 * adentro no se puede poner un botón. Y llevan `nodrag nopan` porque si no, tocarlos
 * arrastra el canvas.
 */

function WaEdgeImpl({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps): ReactElement {
  const d = data as unknown as WaEdgeData;
  const actions = useEditorActions();

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  // El "+" aparece al pasar por encima y se queda fijo con la flecha seleccionada:
  // un botón que sólo existe mientras el mouse está justo ahí es un botón que la
  // mitad de la gente nunca encuentra.
  const mostrarAcciones = selected || actions.hoveredEdgeId === id;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: d.color,
          strokeWidth: d.broken ? 2 : d.highlighted ? 2 : 1.5,
          ...(d.broken || d.ghost ? { strokeDasharray: '6 3' } : {}),
          ...(d.ghost ? { opacity: 0.6 } : {}),
        }}
      />

      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            pointerEvents: 'all',
          }}
        >
          {d.label ? (
            <span
              style={{
                maxWidth: 140,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 10,
                lineHeight: 1.4,
                padding: '1px 6px',
                borderRadius: 999,
                color: d.color,
                border: `1px solid ${d.color}`,
                background: 'var(--bg-base, #fff)',
              }}
              title={d.issues.length ? d.issues.join(' · ') : d.label}
            >
              {d.label}
            </span>
          ) : null}

          {mostrarAcciones && (
            <QuickInsertMenu
              allowed={INSERTABLE_TYPES}
              label="Insertar un paso en el medio"
              size="xsmall"
              onPick={(type) => actions.insertBetween(id, type)}
            />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const WaEdge = memo(WaEdgeImpl);
