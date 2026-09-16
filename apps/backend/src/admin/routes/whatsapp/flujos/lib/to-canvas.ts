/**
 * EL GRAFO PROYECTADO SOBRE EL CANVAS.
 *
 * `Graph` es la única fuente de verdad y el estado de React Flow es una proyección
 * que se puede tirar y volver a calcular. Este archivo ES esa proyección, y está
 * separado de la pantalla porque es donde se decide lo único que React Flow no
 * perdona: a qué conector se engancha cada flecha. Un `sourceHandle` que el nodo no
 * dibuja hace que la arista se descarte EN SILENCIO —el error 008— y el operador ve
 * desaparecer una conexión que estaba bien guardada.
 *
 * Los tipos de React Flow entran como `import type`: se borran al compilar, así que
 * este módulo se puede probar con `node --test` sin tener el paquete instalado.
 */

import type { Edge, MarkerType, Node } from '@xyflow/react';

import {
  canvasKind,
  nextPosition,
  type Graph,
  type GraphNode,
  type NodeType,
} from '../_editor';
import { issuesByEdge, issuesByNode, type EditorIssue } from './issues';
import {
  conditionLabel,
  handleOf,
  outputsOf,
  summaryOf,
  type NodeOutput,
  type OutputKind,
} from './registry';
import { EMPTY_OVERLAY, type CanvasOverlay, type OverlayTone } from './overlays';
import { CARD_WIDTH } from './placement';
import { EMPTY_TRACE, type Trace } from './trace';
import { edgeColors, ERROR_BORDER, optionRow, shadowFor, SKIN, type NodeSkin } from './skin';

export { CARD_WIDTH };

/** Todo lo que la tarjeta necesita saber. Ninguna decisión se toma en el componente. */
export type WaCardData = {
  type: NodeType;
  /** El nombre que le puso el operador, si le puso alguno. */
  name?: string;
  /** El renglón que deja leer el recorrido sin abrir el paso. */
  summary: string;
  outputs: NodeOutput[];
  issues: string[];
  /** Hay al menos un problema que impide publicar. */
  blocked: boolean;
  skin: NodeSkin;
  errorColor: string;
  shadow: string;
  /** La tarjeta va llena de color (la Entrada): el cuadrado del ícono se invierte. */
  inverted: boolean;
  /** El fondo y el borde de una fila de respuesta. */
  rowBg: string;
  rowBorder: string;
  /** Recibe flechas. Una Entrada no. */
  hasTarget: boolean;
  /** Encendido por la prueba: es lo que deja ver por dónde fue la conversación. */
  traced: TraceState;
  /** Anillo y etiqueta del modo Comparar o Métricas. La tarjeta no sabe cuál es. */
  overlayRing?: string;
  overlayBadge?: string;
  overlayTone?: OverlayTone;
  /** Un paso que ya no está en el borrador y se dibuja para mostrar que se borra. */
  ghost?: boolean;
};

export type WaEdgeData = {
  /** Lo que el operador escribió: el nombre de la opción o de la rama, o la condición. */
  label: string;
  kind: OutputKind | 'condition';
  color: string;
  /** Sale o llega al paso seleccionado. */
  highlighted: boolean;
  broken: boolean;
  issues: string[];
  traced: TraceState;
  ghost?: boolean;
};

export type CanvasView = {
  issues: readonly EditorIssue[];
  isDark: boolean;
  /** Los pasos elegidos. Con más de uno, el inspector muestra el del recorrido. */
  selectedIds: readonly string[];
  selectedEdgeId: string | null;
  /** Por dónde pasó la prueba. Vacío mientras el simulador está cerrado. */
  trace?: Trace;
  /** Lo que pinta el modo Comparar o Métricas. Vacío en el modo de edición. */
  overlay?: CanvasOverlay;
};

/** Qué tan encendido está un paso en la prueba: nada, ya recorrido, o recién ahora. */
export type TraceState = 'none' | 'past' | 'current';

export function toCanvas(graph: Graph, view: CanvasView): { nodes: Node[]; edges: Edge[] } {
  const tema = view.isDark ? 'dark' : 'light';
  const skins = SKIN[tema];
  const errorColor = ERROR_BORDER[tema];
  const colors = edgeColors(view.isDark);
  const shadow = shadowFor(view.isDark);

  const porNodo = issuesByNode(view.issues);
  const porArista = issuesByEdge(view.issues);
  const fila = optionRow(view.isDark);

  const trace = view.trace ?? EMPTY_TRACE;
  const overlay = view.overlay ?? EMPTY_OVERLAY;

  /**
   * Los pasos que se borran se dibujan igual, tomados del recorrido publicado y en la
   * posición que tenían: sin ellos, "borraste el paso de ayuda" sería un renglón en
   * una lista en vez de un hueco en el diagrama.
   */
  const fantasmas = new Set(overlay.ghostNodes.map((n) => n.id));
  const nodosADibujar = [...graph.nodes, ...overlay.ghostNodes.filter((n) => !graph.nodes.some((x) => x.id === n.id))];
  const aristasADibujar = [
    ...graph.edges,
    ...overlay.ghostEdges.filter((e) => !graph.edges.some((x) => x.id === e.id)),
  ];
  const nodosRecorridos = new Set(trace.nodeIds);
  const nodosDelTurno = new Set(trace.currentNodeIds);
  const aristasRecorridas = new Set(trace.edgeIds);
  const aristasDelTurno = new Set(trace.currentEdgeIds);
  const estado = (id: string, ahora: Set<string>, antes: Set<string>): TraceState =>
    ahora.has(id) ? 'current' : antes.has(id) ? 'past' : 'none';

  // Las salidas se calculan UNA vez por nodo y las usan las dos mitades: la tarjeta
  // para dibujar los conectores y la arista para engancharse. Calcularlas dos veces
  // es exactamente cómo se desincronizan.
  const salidas = new Map<string, NodeOutput[]>();
  for (const node of nodosADibujar) {
    salidas.set(
      node.id,
      outputsOf(
        node,
        aristasADibujar.filter((e) => e.source === node.id),
      ),
    );
  }

  const nodes: Node[] = nodosADibujar.map((node, index) => {
    const problemas = porNodo.get(node.id) ?? [];
    const data: WaCardData = {
      type: node.type,
      ...(nombreDe(node) ? { name: nombreDe(node) } : {}),
      summary: summaryOf(node),
      outputs: salidas.get(node.id) ?? [],
      issues: problemas.map((i) => i.message),
      blocked: problemas.some((i) => i.severity === 'blocking'),
      skin: skins[node.type] ?? skins.message,
      errorColor,
      shadow,
      // La Entrada es la única con la tarjeta llena de color.
      inverted: (skins[node.type] ?? skins.message).bg === (skins[node.type] ?? skins.message).accent,
      rowBg: fila.bg,
      rowBorder: fila.border,
      hasTarget: canvasKind(node.type) !== 'input',
      traced: estado(node.id, nodosDelTurno, nodosRecorridos),
      ...(overlay.nodes[node.id]?.ring ? { overlayRing: overlay.nodes[node.id]?.ring } : {}),
      ...(overlay.nodes[node.id]?.badge ? { overlayBadge: overlay.nodes[node.id]?.badge } : {}),
      ...(overlay.nodes[node.id]?.tone ? { overlayTone: overlay.nodes[node.id]?.tone } : {}),
      ...(fantasmas.has(node.id) ? { ghost: true } : {}),
    };
    return {
      id: node.id,
      type: 'wa',
      // Sin posición guardada caen en grilla: apilados en el origen, el recorrido
      // se ve como un solo nodo.
      position: node.position ?? nextPosition(index),
      selected: view.selectedIds.includes(node.id),
      // Ancho fijo y alto libre: la tarjeta crece con su contenido y React Flow la
      // mide. Fijar el alto recortaría el texto de los pasos largos.
      width: CARD_WIDTH,
      // Un paso que ya no está en el borrador se dibuja para mostrar el hueco, pero no
      // se puede agarrar: moverlo no tendría dónde guardarse y volvería solo.
      ...(fantasmas.has(node.id) ? { draggable: false, selectable: false } : {}),
      data: data as unknown as Record<string, unknown>,
    };
  });

  const edges: Edge[] = aristasADibujar.map((edge) => {
    const outputs = salidas.get(edge.source) ?? [];
    const handle = handleOf(edge, outputs);
    const output = outputs.find((o) => o.id === handle);
    const problemas = porArista.get(edge.id) ?? [];
    const broken = problemas.some((i) => i.severity === 'blocking');
    const highlighted =
      view.selectedEdgeId === edge.id ||
      view.selectedIds.includes(edge.source) ||
      view.selectedIds.includes(edge.target);

    const traced = estado(edge.id, aristasDelTurno, aristasRecorridas);
    // El camino recorrido gana sobre el resaltado por selección: durante una prueba,
    // lo que se viene a mirar es por dónde fue la conversación.
    const pintado = overlay.edges[edge.id];

    /**
     * Una flecha que sale de una RESPUESTA toma el color de su paso de origen.
     *
     * Es lo que deja seguir una rama con la vista en un recorrido de treinta flechas:
     * las tres salidas de un menú se ven como tres caminos distintos y no como tres
     * líneas grises iguales. Las flechas de una cadena lineal quedan neutras, porque
     * ahí no hay nada que distinguir.
     */
    const delTipo = skins[graph.nodes.find((n) => n.id === edge.source)?.type ?? 'message'];
    const ramificada = (output?.kind === 'option' || output?.kind === 'branch') && !broken;

    const color =
      pintado?.color ??
      (traced !== 'none'
        ? colors.traced
        : broken
          ? colors.broken
          : ramificada
            ? delTipo.accent
            : highlighted
              ? colors.highlighted
              : colors.rest);

    const data: WaEdgeData = {
      // La etiqueta del overlay GANA: en modo métricas lo que importa es el
      // porcentaje, no el nombre de la opción que ya se lee en la tarjeta.
      label: pintado?.label ?? etiquetaDe(edge.on, output, edge.when ? conditionLabel(edge.when) : ''),
      kind: edge.when && !edge.on ? 'condition' : (output?.kind ?? 'single'),
      color,
      highlighted,
      broken,
      issues: problemas.map((i) => i.message),
      traced,
      ...(pintado?.dashed ? { ghost: true } : {}),
    };

    return {
      id: edge.id,
      type: 'wa',
      source: edge.source,
      target: edge.target,
      // SIEMPRE explícito: sin esto React Flow engancha la flecha al primer conector
      // del nodo, así que las tres ramas de una pregunta salían del mismo punto y el
      // dibujo mentía sobre cuál era cuál.
      sourceHandle: handle,
      selected: view.selectedEdgeId === edge.id,
      // Sólo el tramo del último turno se anima: animar el camino entero convierte el
      // canvas en un cartel de neón y deja de decir qué acaba de pasar.
      animated: traced === 'current',
      markerEnd: { type: 'arrowclosed' as MarkerType, color, width: 16, height: 16 },
      data: data as unknown as Record<string, unknown>,
    };
  });

  return { nodes, edges };
}

const nombreDe = (node: GraphNode): string | undefined => (node.label ?? '').trim() || undefined;

/**
 * Lo que dice el chip de la flecha.
 *
 * El nombre que escribió el operador, nunca el id interno: una flecha etiquetada
 * "salida_2" no le dice nada a nadie. Las salidas únicas no llevan chip — un
 * rótulo en cada flecha de una cadena lineal es ruido.
 */
function etiquetaDe(on: string | undefined, output: NodeOutput | undefined, condicion: string): string {
  if (output && output.kind !== 'single' && output.label) return output.label;
  if (condicion) return condicion;
  return on ?? '';
}

/**
 * Funde la proyección nueva con lo que React Flow ya sabía de cada nodo.
 *
 * Dos cosas que sólo sabe él y se perderían al repintar: la MEDIDA (la calcula
 * midiendo el DOM, y sin ella el `fitView` y el minimapa salen mal el primer
 * frame) y la posición DURANTE un arrastre, que todavía no llegó al grafo. Sin
 * esto, repintar por un cambio de tema o de problemas en medio de un arrastre
 * teletransporta la tarjeta al lugar donde estaba antes de agarrarla.
 */
export function mergeCanvasState(next: Node[], prev: readonly Node[]): Node[] {
  const anterior = new Map(prev.map((n) => [n.id, n]));
  return next.map((node) => {
    const viejo = anterior.get(node.id);
    if (!viejo) return node;
    return {
      ...node,
      ...(viejo.measured ? { measured: viejo.measured } : {}),
      ...(viejo.dragging ? { position: viejo.position, dragging: true } : {}),
    };
  });
}
