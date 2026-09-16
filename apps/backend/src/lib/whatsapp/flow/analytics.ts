/**
 * POR DÓNDE PASAN LAS CONVERSACIONES REALES, agregado sobre el event log.
 *
 * El embudo de `whatsapp-analytics` cuenta etapas comerciales —búsqueda, productos,
 * carrito, checkout— y el visor de `whatsapp-sessions` muestra UNA conversación. Lo
 * que faltaba es lo del medio: cuántas conversaciones entran a cada paso del recorrido
 * DIBUJADO, por qué rama salen y dónde se caen. Es la diferencia entre "el bot
 * convierte poco" y "el 60% abandona en la pregunta de la presentación".
 *
 * Es DATO PURO: no importa Medusa ni toca la base. La ruta lee las filas y se las
 * pasa; así esto se prueba con una tabla de casos y sin levantar nada.
 */

import type { FlowGraph } from './graph';

/** Una fila de `whatsapp_event`, con lo mínimo que hace falta. */
export type FlowEventRow = {
  phone: string;
  session_id: string | null;
  type: string;
  step: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | Date;
  seq?: number | null;
};

export type NodeStats = {
  /** Conversaciones que entraron a este paso. */
  sessions: number;
  /**
   * Conversaciones que se quedaron ACÁ: fue su último paso y no llegaron a un final
   * ni a una derivación. Es el abandono, que es lo que se viene a buscar.
   */
  dropped: number;
};

export type EdgeStats = {
  sessions: number;
  /** Qué porcentaje de las que pasaron por el paso de origen salió por acá. */
  percent_of_source: number;
  /**
   * `true` si hubo que adivinar: la conversación es anterior a que el motor registrara
   * la arista, y dos salidas del mismo paso terminan en el mismo destino.
   */
  ambiguous?: boolean;
};

export type FlowAnalytics = {
  sessions_total: number;
  nodes: Record<string, NodeStats>;
  edges: Record<string, EdgeStats>;
};

/** `(created_at, seq)`: los eventos se emiten sin esperar y comparten milisegundo. */
const porEmision = (a: FlowEventRow, b: FlowEventRow): number => {
  const dif = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  if (dif !== 0) return dif;
  return (a.seq ?? 0) - (b.seq ?? 0);
};

/** Los eventos viejos no tienen `session_id`: se agrupan por teléfono y día. */
const claveDeSesion = (row: FlowEventRow): string =>
  row.session_id ?? `legacy:${row.phone}:${new Date(row.created_at).toISOString().slice(0, 10)}`;

export function aggregateFlowAnalytics(
  rows: readonly FlowEventRow[],
  graph: FlowGraph,
  versionId?: string,
): FlowAnalytics {
  const tipoDe = new Map(graph.nodes.map((n) => [n.id, n.type]));
  const aristas = graph.edges;

  // Sólo los pasos del recorrido, y sólo los de la versión que se está mirando: una
  // versión anterior tiene otros ids de nodo y mezclarlos inventa números.
  const relevantes = rows.filter(
    (r) =>
      r.type === 'node_entered' &&
      (!versionId || r.payload?.version_id === versionId) &&
      Boolean(nodeIdDe(r)),
  );

  const porSesion = new Map<string, FlowEventRow[]>();
  for (const row of relevantes) {
    const clave = claveDeSesion(row);
    porSesion.set(clave, [...(porSesion.get(clave) ?? []), row]);
  }

  const nodes: Record<string, NodeStats> = {};
  const edges: Record<string, EdgeStats> = {};
  const ambiguas = new Set<string>();

  const sumarNodo = (id: string, campo: keyof NodeStats) => {
    nodes[id] ??= { sessions: 0, dropped: 0 };
    (nodes[id] as NodeStats)[campo] += 1;
  };
  const sumarArista = (id: string) => {
    edges[id] ??= { sessions: 0, percent_of_source: 0 };
    (edges[id] as EdgeStats).sessions += 1;
  };

  for (const [, eventos] of porSesion) {
    const ordenados = [...eventos].sort(porEmision);
    const pasos = ordenados.map(nodeIdDe).filter((id): id is string => Boolean(id));

    // Una sesión cuenta UNA vez por paso, aunque haya vuelto a pasar: lo que se mide
    // es cuántas conversaciones llegaron, no cuántas vueltas dieron.
    for (const id of new Set(pasos)) sumarNodo(id, 'sessions');

    for (const [index, row] of ordenados.entries()) {
      const desde = nodeIdDe(row);
      const hasta = index + 1 < ordenados.length ? nodeIdDe(ordenados[index + 1] as FlowEventRow) : null;
      if (!desde || !hasta) continue;

      const registrada = edgeIdDe(ordenados[index + 1] as FlowEventRow);
      if (registrada && aristas.some((e) => e.id === registrada)) {
        sumarArista(registrada);
        continue;
      }

      // Sin el id registrado —conversaciones anteriores al cambio— se busca por el par
      // de nodos, y si hay más de una candidata se toma la primera y se marca.
      const candidatas = aristas.filter((e) => e.source === desde && e.target === hasta);
      const elegida = candidatas[0];
      if (!elegida) continue;
      sumarArista(elegida.id);
      if (candidatas.length > 1) ambiguas.add(elegida.id);
    }

    const ultimo = pasos[pasos.length - 1];
    if (!ultimo) continue;
    const tipo = tipoDe.get(ultimo);
    // Terminar en un final o en una derivación no es abandonar: es el recorrido
    // haciendo lo que tenía que hacer.
    if (tipo !== 'end' && tipo !== 'handoff') sumarNodo(ultimo, 'dropped');
  }

  for (const [id, stats] of Object.entries(edges)) {
    const arista = aristas.find((e) => e.id === id);
    const delOrigen = arista ? nodes[arista.source]?.sessions ?? 0 : 0;
    stats.percent_of_source = delOrigen ? Math.round((stats.sessions / delOrigen) * 1000) / 10 : 0;
    if (ambiguas.has(id)) stats.ambiguous = true;
  }

  return { sessions_total: porSesion.size, nodes, edges };
}

const nodeIdDe = (row: FlowEventRow): string | null =>
  row.step ?? (typeof row.payload?.node_id === 'string' ? row.payload.node_id : null);

const edgeIdDe = (row: FlowEventRow): string | null =>
  typeof row.payload?.edge_id === 'string' ? row.payload.edge_id : null;
