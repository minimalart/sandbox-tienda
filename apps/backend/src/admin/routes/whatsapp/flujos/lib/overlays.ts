/**
 * LO QUE SE PINTA ENCIMA DEL CANVAS sin cambiar el recorrido.
 *
 * El mismo dibujo sirve para tres preguntas distintas, y las tres se contestan mejor
 * sobre el diagrama que en una tabla al costado:
 *
 *   Editar     qué hace el recorrido
 *   Comparar   qué cambia respecto de lo que está atendiendo ahora
 *   Métricas   por dónde pasa la gente de verdad y dónde se cae
 *
 * Los tres modos producen la MISMA forma —un color de anillo y una etiqueta por paso,
 * un color y una etiqueta por flecha— así que la tarjeta y la flecha no saben en qué
 * modo están: reciben el overlay ya resuelto. Sin eso, cada componente tendría un
 * `if (mode === …)` y el tercer modo tocaría los cinco archivos del canvas.
 */

import type { Graph, GraphEdge, GraphNode } from '../_editor';
import { diffGraphs, type GraphDiff } from './diff';

export type OverlayTone = 'ok' | 'warn' | 'error' | 'muted';

export type NodeOverlay = { ring?: string; badge?: string; tone?: OverlayTone };
export type EdgeOverlay = { color?: string; label?: string; dashed?: boolean };

export type CanvasOverlay = {
  nodes: Record<string, NodeOverlay>;
  edges: Record<string, EdgeOverlay>;
  /**
   * Pasos que NO están en el grafo que se edita y hay que dibujar igual: los que la
   * comparación muestra como borrados. Sin ellos, "borraste el paso de ayuda" sería
   * un renglón en una lista y no un hueco en el diagrama.
   */
  ghostNodes: GraphNode[];
  ghostEdges: GraphEdge[];
};

export const EMPTY_OVERLAY: CanvasOverlay = { nodes: {}, edges: {}, ghostNodes: [], ghostEdges: [] };

export type CanvasMode = 'edit' | 'compare' | 'metrics';

const COLORS = {
  added: '#1EA952',
  removed: '#D32F2F',
  changed: '#E8A33D',
} as const;

/** Qué cambia el borrador respecto de lo publicado. */
export function compareOverlay(draft: Graph, published: Graph): CanvasOverlay {
  const diff: GraphDiff = diffGraphs(published, draft);
  const overlay: CanvasOverlay = { nodes: {}, edges: {}, ghostNodes: [], ghostEdges: [] };

  for (const id of diff.nodes.added) {
    overlay.nodes[id] = { ring: COLORS.added, badge: 'Nuevo', tone: 'ok' };
  }
  for (const change of diff.nodes.changed) {
    overlay.nodes[change.id] = {
      ring: COLORS.changed,
      badge: `Cambió: ${change.fields.map(nombreDeCampo).join(', ')}`,
      tone: 'warn',
    };
  }
  for (const id of diff.edges.added) overlay.edges[id] = { color: COLORS.added };

  // Los borrados salen del grafo PUBLICADO, en la posición que tenían: así se ve el
  // hueco donde estaban y no una lista aparte que hay que cruzar a mano.
  const enElBorrador = new Set(draft.nodes.map((n) => n.id));
  for (const id of diff.nodes.removed) {
    const node = published.nodes.find((n) => n.id === id);
    if (!node) continue;
    overlay.ghostNodes.push(node);
    overlay.nodes[id] = { ring: COLORS.removed, badge: 'Se borra', tone: 'error' };
  }
  for (const id of diff.edges.removed) {
    const edge = published.edges.find((e) => e.id === id);
    if (!edge) continue;
    // Sólo si sus dos extremos se van a poder dibujar.
    const dibujable =
      (enElBorrador.has(edge.source) || overlay.ghostNodes.some((n) => n.id === edge.source)) &&
      (enElBorrador.has(edge.target) || overlay.ghostNodes.some((n) => n.id === edge.target));
    if (!dibujable) continue;
    overlay.ghostEdges.push(edge);
    overlay.edges[edge.id] = { color: COLORS.removed, dashed: true };
  }

  return overlay;
}

export type AnalyticsInput = {
  sessions_total: number;
  nodes: Record<string, { sessions: number; dropped: number }>;
  edges: Record<string, { sessions: number; percent_of_source: number; ambiguous?: boolean }>;
};

/** A partir de qué proporción de abandono un paso se marca en rojo. */
export const DROP_ALERT = 0.3;

/** Cuántas conversaciones pasan por cada paso y por dónde salen. */
export function metricsOverlay(analytics: AnalyticsInput): CanvasOverlay {
  const overlay: CanvasOverlay = { nodes: {}, edges: {}, ghostNodes: [], ghostEdges: [] };

  for (const [id, stats] of Object.entries(analytics.nodes)) {
    const abandono = stats.sessions > 0 ? stats.dropped / stats.sessions : 0;
    const alerta = abandono >= DROP_ALERT;
    overlay.nodes[id] = {
      ...(alerta ? { ring: COLORS.removed } : {}),
      badge: stats.dropped > 0
        ? `${stats.sessions} conv. · ${Math.round(abandono * 100)}% se corta acá`
        : `${stats.sessions} conv.`,
      tone: alerta ? 'error' : 'muted',
    };
  }

  // Los pasos por los que no pasó NADIE se marcan aparte: puede ser una rama recién
  // publicada o una a la que no se llega nunca, y las dos merecen una mirada.
  for (const [id, stats] of Object.entries(analytics.edges)) {
    overlay.edges[id] = {
      label: `${stats.percent_of_source}%${stats.ambiguous ? ' aprox.' : ''}`,
    };
  }

  return overlay;
}

const NOMBRES: Record<string, string> = {
  body: 'el texto',
  options: 'las respuestas',
  branches: 'las salidas',
  label: 'el nombre',
  tool: 'la acción',
  args: 'los datos de la acción',
  match: 'los disparadores',
  optionsFrom: 'las respuestas en vivo',
  listButton: 'el botón de la lista',
  silent: 'el encadenado',
  reason: 'el motivo',
  type: 'el tipo',
};

const nombreDeCampo = (campo: string): string => NOMBRES[campo] ?? campo;
