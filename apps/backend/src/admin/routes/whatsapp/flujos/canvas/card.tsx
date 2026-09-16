import { ExclamationCircle, SquareTwoStack, Trash } from '@medusajs/icons';
import { IconButton, Tooltip } from '@medusajs/ui';
import { Handle, NodeToolbar, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { memo, useEffect, type CSSProperties, type ReactElement } from 'react';

import { CONNECTABLE_TARGET_TYPES, TYPE_LABEL } from '../_editor';
import { DEFAULT_HANDLE, type NodeOutput } from '../lib/registry';
import type { WaCardData } from '../lib/to-canvas';
import { useEditorActions } from './editor-context';
import { QuickInsertMenu } from './quick-insert-menu';
import { TypeIcon } from './type-icon';

/**
 * LA TARJETA DE UN PASO.
 *
 * Tarjeta BLANCA con un cuadrado de color y su ícono. Antes cada nodo se pintaba
 * entero del color de su tipo: con nueve colores saturados el canvas se leía como un
 * mosaico, y el texto del mensaje —que es lo que se vino a mostrar— competía con su
 * propio fondo.
 *
 * Las respuestas de una pregunta son FILAS con su propio conector, cada una del color
 * del paso. Es lo que deja ver de un vistazo cuál lleva a dónde y cuál todavía no
 * lleva a ningún lado.
 *
 * No decide nada: todo lo que dibuja viene resuelto en `data` desde `toCanvas`, que
 * es puro y está probado. Un componente del admin no se puede testear en este repo,
 * así que cualquier decisión acá adentro sería una que nadie verifica.
 */

/** El verde del camino recorrido en una prueba. El mismo de la marca. */
const TRACE_RING = '#25D366';
const TRACE_RING_PAST = 'rgba(37, 211, 102, .45)';

function WaCardImpl({ id, data, selected }: NodeProps): ReactElement {
  const d = data as unknown as WaCardData;
  const actions = useEditorActions();
  const updateNodeInternals = useUpdateNodeInternals();

  /**
   * React Flow cachea la posición de cada conector cuando mide el nodo. Si cambia la
   * cantidad de conectores —el operador agrega una respuesta o una rama— o cambia el
   * alto —el texto creció—, las flechas siguen apuntando al lugar viejo hasta el
   * próximo arrastre. Esto le avisa que vuelva a medir.
   */
  const outputsKey = d.outputs.map((o) => o.id).join('|');
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, outputsKey, d.summary.length, updateNodeInternals]);

  const salidaUnica = d.outputs.find((o) => o.kind === 'single');
  const filas = d.outputs.filter((o) => o.kind !== 'single');
  const anillo = anilloDe(d, Boolean(selected));

  const card: CSSProperties = {
    position: 'relative',
    width: '100%',
    borderRadius: 10,
    border: `1px solid ${d.blocked ? d.errorColor : d.skin.border}`,
    background: d.skin.bg,
    color: d.skin.fg,
    boxShadow: anillo ? `0 0 0 2px ${anillo}, ${d.shadow}` : d.shadow,
    opacity: d.ghost ? 0.5 : 1,
    fontSize: 12,
    lineHeight: 1.35,
  };

  return (
    <div style={card}>
      <NodeToolbar isVisible={Boolean(selected)} position={Position.Top} align="end" offset={8}>
        <div className="flex items-center gap-x-1 rounded-md border bg-ui-bg-base p-1 shadow-elevation-card-rest">
          <IconButton size="small" variant="transparent" aria-label="Duplicar" onClick={() => actions.duplicate(id)}>
            <SquareTwoStack />
          </IconButton>
          <IconButton size="small" variant="transparent" aria-label="Eliminar" onClick={() => actions.remove(id)}>
            <Trash />
          </IconButton>
        </div>
      </NodeToolbar>

      {/* Una Entrada no recibe flechas: dibujarle un conector deja pintar recorridos
          que el motor nunca recorre, sin que nada lo diga. */}
      {d.hasTarget && (
        <Handle type="target" position={Position.Top} style={{ background: d.skin.accent, border: 'none', width: 7, height: 7 }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px 7px' }}>
        {/* En la Entrada el cuadrado va blanco sobre el verde de la tarjeta: al revés
            desaparecería contra su propio fondo. */}
        <TypeIcon
          type={d.type}
          background={d.inverted ? 'rgba(255,255,255,.22)' : d.skin.accent}
          color={d.skin.onAccent}
          size="small"
        />
        <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {TYPE_LABEL[d.type]}
        </span>
        {d.issues.length > 0 && (
          <Tooltip content={d.issues.join(' · ')}>
            <span style={{ display: 'flex', color: d.errorColor }}>
              <ExclamationCircle />
            </span>
          </Tooltip>
        )}
      </div>

      {d.name ? (
        <div style={{ padding: '0 10px 4px', opacity: 0.55, fontSize: 11 }}>{d.name}</div>
      ) : null}

      {d.overlayBadge && (
        <div style={{ padding: '0 10px 6px' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 6px',
              borderRadius: 5,
              fontSize: 10,
              fontWeight: 600,
              background: d.overlayRing ?? 'rgba(17,24,39,.06)',
              color: d.overlayRing ? '#FFFFFF' : d.skin.fg,
            }}
          >
            {d.overlayBadge}
          </span>
        </div>
      )}

      {d.summary ? (
        <div
          style={{
            padding: '0 10px 10px',
            opacity: 0.85,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {d.summary}
        </div>
      ) : (
        <div style={{ padding: '0 10px 10px', opacity: 0.4, fontStyle: 'italic' }}>Sin configurar</div>
      )}

      {filas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '0 10px 10px' }}>
          {filas.map((output) => (
            <OutputRow key={output.id} nodeId={id} output={output} data={d} />
          ))}
        </div>
      )}

      {/* La salida única va abajo y al centro, como la flecha de cualquier diagrama. */}
      {salidaUnica && (
        <>
          <Handle
            type="source"
            id={DEFAULT_HANDLE}
            position={Position.Bottom}
            style={{ background: d.skin.accent, border: 'none', width: 7, height: 7 }}
          />
          {!salidaUnica.wired && !d.ghost && (
            <div
              className="nodrag nopan"
              style={{ position: 'absolute', left: '50%', top: '100%', transform: 'translate(-50%, 6px)' }}
            >
              <QuickInsertMenu
                allowed={CONNECTABLE_TARGET_TYPES}
                label="Agregar el paso que sigue"
                size="xsmall"
                onPick={(type) => actions.addAndConnect(id, DEFAULT_HANDLE, type)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Qué anillo lleva la tarjeta.
 *
 * El orden importa: la prueba gana sobre la comparación y las dos sobre la selección.
 * Mientras se prueba, lo que se viene a mirar es por dónde fue la conversación.
 */
function anilloDe(d: WaCardData, selected: boolean): string | null {
  if (d.traced === 'current') return TRACE_RING;
  if (d.traced === 'past') return TRACE_RING_PAST;
  if (d.overlayRing) return d.overlayRing;
  if (selected) return d.skin.accent;
  return null;
}

/**
 * Una respuesta de la pregunta, o una rama de la bifurcación, con SU conector.
 *
 * La fila se dibuja como el botón que el cliente va a ver, y el conector va sobre el
 * borde derecho: es lo único que deja ver de qué respuesta sale cada flecha. Cuando
 * no lleva a ningún lado aparece el "+", que crea el paso siguiente y lo conecta.
 */
function OutputRow({
  nodeId,
  output,
  data,
}: {
  nodeId: string;
  output: NodeOutput;
  data: WaCardData;
}): ReactElement {
  const actions = useEditorActions();
  // Punteada y en itálica: no es una respuesta del cliente, es lo que pasa cuando
  // ninguna llega. Se lee distinto de las tres que sí se van a ver en el teléfono.
  const suelta =
    output.kind === 'legacy' || output.kind === 'fallback' || output.kind === 'timeout';

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 9px',
        borderRadius: 7,
        background: data.rowBg,
        border: `1px solid ${suelta ? 'transparent' : data.rowBorder}`,
        borderStyle: suelta ? 'dashed' : 'solid',
        borderColor: suelta ? data.rowBorder : data.rowBorder,
        opacity: suelta ? 0.8 : 1,
      }}
    >
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontStyle: suelta ? 'italic' : 'normal',
        }}
      >
        {output.label}
      </span>

      {/* Una rama sin condición es la de por default: se marca para que se lea como
          "lo que queda" y no como una más. */}
      {output.isDefaultBranch && <span style={{ opacity: 0.5, fontSize: 10 }}>por default</span>}

      {!output.wired && !data.ghost && (
        <span className="nodrag nopan" style={{ display: 'flex' }}>
          <QuickInsertMenu
            allowed={CONNECTABLE_TARGET_TYPES}
            label={`Conectar "${output.label}"`}
            size="xsmall"
            onPick={(type) => actions.addAndConnect(nodeId, output.id, type)}
          />
        </span>
      )}

      <Handle
        type="source"
        id={output.id}
        position={Position.Right}
        style={{
          top: '50%',
          right: -11,
          background: output.wired ? data.skin.accent : '#FFFFFF',
          border: `2px solid ${data.skin.accent}`,
          width: 9,
          height: 9,
        }}
      />
    </div>
  );
}

export const WaCard = memo(WaCardImpl);
