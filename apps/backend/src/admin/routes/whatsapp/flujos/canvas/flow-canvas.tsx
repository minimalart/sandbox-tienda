import {
  Background,
  MiniMap,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  type Connection,
  type Edge,
  type FitViewOptions,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  type ProOptions,
} from '@xyflow/react';
import { useCallback, useEffect, useRef, type DragEvent, type ReactElement } from 'react';

import type { NodeType } from '../_editor';
import { isDeleteKey, isEditableTarget } from '../lib/keys';
import { CARD_WIDTH, type WaCardData } from '../lib/to-canvas';
import { backgroundDot, minimapMask, minimapSurface, WA } from '../lib/skin';
import { CanvasControls } from './canvas-controls';
import { stepTypeFrom } from './dnd';
import { EDGE_TYPES_RF, NODE_TYPES_RF } from './node-types';

export type FlowCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: (connection: Connection) => void;
  /** Vuelca al grafo las posiciones que el operador movió. */
  onNodeDragStop: () => void;
  /** La selección completa: puede ser más de un paso. */
  onSelectNodes: (ids: string[]) => void;
  onSelectEdge: (id: string | null) => void;
  onDeleteSelection: () => void;
  onDropStep: (type: NodeType, position: { x: number; y: number }) => void;
  onHoverEdge: (id: string | null) => void;
  isDark: boolean;
  minimapOn: boolean;
  onToggleMinimap: () => void;
  selectedIds: readonly string[];
  selectedEdgeId: string | null;
};

/**
 * TODO LO QUE NO ES PRIMITIVO, FUERA DEL RENDER.
 *
 * React Flow guarda cada prop en su store de Zustand y lo REESCRIBE cuando le cambia
 * la identidad. Un objeto o una función declarados inline son nuevos en cada render,
 * así que cada render escribe el store, el store despierta a sus suscriptores, eso
 * dispara otro render — y el canvas entero parpadea sin que nadie toque nada.
 *
 * Se vio en producción el 2026-09-16: el inspector saltaba solo entre el panel del
 * paso y el del recorrido, con el mouse quieto. No dejó ni un error en consola, que
 * es lo que hace que este tipo de bug se busque en el lugar equivocado.
 */
const FIT_VIEW_OPTIONS: FitViewOptions = { padding: 0.15, maxZoom: 1 };
const PRO_OPTIONS: ProOptions = { hideAttribution: false };

/** Feedback mientras se arrastra. La decisión real la toma `connect()`. */
const isValidConnection = (connection: Connection | Edge): boolean =>
  connection.source !== connection.target;

/** Cada nodo con SU color: en gris, el minimapa deja de servir para ubicarse. */
const minimapNodeColor = (node: Node): string =>
  (node.data as unknown as WaCardData)?.skin?.bg ?? WA.teal;

/** Dos listas de ids con los mismos elementos, en el mismo orden. */
const mismosIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * El canvas.
 *
 * Tres reglas que no se pueden relajar:
 *
 * 1. `deleteKeyCode={null}`. React Flow borra con Delete por su cuenta y no sabe
 *    nada del inspector que está al lado: con un paso seleccionado, borrar una letra
 *    del texto del mensaje borraba EL PASO ENTERO. El teclado lo maneja el editor,
 *    que sí puede preguntar dónde está el foco (`isEditableTarget`).
 * 2. `onNodesChange` alimenta SÓLO el estado de React Flow —posición, selección,
 *    medidas—. Nada de acá escribe en el grafo salvo `onNodeDragStop`, que vuelca
 *    las posiciones. El grafo es la única fuente de verdad y esto es su proyección.
 * 3. NINGÚN prop de `<ReactFlow>` se declara inline. Ver el comentario de arriba.
 */
export function FlowCanvas(props: FlowCanvasProps): ReactElement {
  const { screenToFlowPosition } = useReactFlow();

  /**
   * Los callbacks del editor, siempre frescos, sin cambiar de identidad.
   *
   * Es lo que deja memoizar los handlers con `[]`: leen del ref en vez de capturar
   * las props del render en que se crearon. Sin esto, cada handler dependería de
   * `props` y volveríamos a escribir el store de React Flow en cada render.
   */
  const latest = useRef(props);
  latest.current = props;

  /**
   * El teclado, con la guarda del foco.
   *
   * Va en `window` y no en el div del canvas porque el foco puede estar en el
   * `<body>` después de un clic en el fondo, y ahí un handler local no escucha. Se
   * registra UNA vez: antes dependía de `props` y se desregistraba y volvía a
   * registrar en cada render.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target as { tagName?: string; isContentEditable?: boolean } | null)) return;
      if (isDeleteKey(event.key)) {
        event.preventDefault();
        latest.current.onDeleteSelection();
        return;
      }
      if (event.key === 'Escape') {
        latest.current.onSelectNodes([]);
        latest.current.onSelectEdge(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Sin `preventDefault` en el dragover el navegador no dispara el `drop`: es el
  // olvido clásico y se manifiesta como "arrastro y no pasa nada".
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = stepTypeFrom(event.dataTransfer);
      if (!type) return;
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      // Media tarjeta a la izquierda: el paso queda centrado donde se soltó y no
      // colgando a la derecha del cursor.
      latest.current.onDropStep(type, {
        x: Math.round(point.x - CARD_WIDTH / 2),
        y: Math.round(point.y - 20),
      });
    },
    [screenToFlowPosition],
  );

  /**
   * La selección la maneja React Flow —clic, Shift+clic y recuadro— y acá sólo se
   * refleja. Manejarla a mano con `onNodeClick` obligaba a reimplementar las tres
   * formas y dejaba la de recuadro sin existir.
   *
   * Se compara antes de avisar: React Flow dispara esto también al montar y con cada
   * reproyección, y avisar de más devuelve el mismo estado con un array nuevo, que es
   * un render de más por cada movimiento del mouse.
   */
  const onSelectionChange = useCallback(
    ({ nodes: elegidos, edges: flechas }: { nodes: Node[]; edges: Edge[] }) => {
      const ids = elegidos.map((n) => n.id);
      if (!mismosIds(ids, latest.current.selectedIds)) latest.current.onSelectNodes(ids);
      const flecha = flechas[0]?.id ?? null;
      if (flecha !== latest.current.selectedEdgeId) latest.current.onSelectEdge(flecha);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    latest.current.onSelectNodes([]);
    latest.current.onSelectEdge(null);
  }, []);

  const onNodeDragStop = useCallback(() => latest.current.onNodeDragStop(), []);
  const onConnect = useCallback((connection: Connection) => latest.current.onConnect(connection), []);
  const onEdgeMouseEnter = useCallback(
    (_event: unknown, edge: Edge) => latest.current.onHoverEdge(edge.id),
    [],
  );
  const onEdgeMouseLeave = useCallback(() => latest.current.onHoverEdge(null), []);

  return (
    <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={props.nodes}
        edges={props.edges}
        onNodesChange={props.onNodesChange}
        onEdgesChange={props.onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        /**
         * ARRASTRAR SOBRE EL FONDO MUEVE EL CANVAS. Es lo primero que alguien intenta
         * al entrar a un diagrama grande, y era lo único que no funcionaba: el
         * izquierdo dibujaba un recuadro de selección y moverse quedaba reservado al
         * botón del medio —que en un trackpad no existe— o a la rueda.
         *
         * Seleccionar de a varios pasa a pedir Shift, que es la tecla que ya sumaba de
         * a uno: una sola tecla para las dos formas de elegir varios.
         */
        selectionMode={SelectionMode.Partial}
        panOnDrag={PAN_BUTTONS}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        nodeTypes={NODE_TYPES_RF}
        edgeTypes={EDGE_TYPES_RF}
        // Ajusta UNA vez, cuando mide los nodos por primera vez. Reajustar en cada
        // cambio le mueve el piso al operador mientras dibuja.
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        deleteKeyCode={null}
        isValidConnection={isValidConnection}
        colorMode={props.isDark ? 'dark' : 'light'}
        proOptions={PRO_OPTIONS}
      >
        <Background color={backgroundDot(props.isDark)} gap={18} />
        <CanvasControls minimapOn={props.minimapOn} onToggleMinimap={props.onToggleMinimap} />
        {props.minimapOn && (
          <MiniMap
            pannable
            zoomable
            nodeColor={minimapNodeColor}
            maskColor={minimapMask(props.isDark)}
            style={{ background: minimapSurface(props.isDark) }}
          />
        )}
      </ReactFlow>
    </div>
  );
}

/** Los tres botones desplazan. Con Shift, el izquierdo dibuja el recuadro. */
const PAN_BUTTONS = [0, 1, 2];
