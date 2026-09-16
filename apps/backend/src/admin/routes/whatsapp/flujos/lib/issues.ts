/**
 * LOS PROBLEMAS DEL RECORRIDO, calculados mientras se dibuja.
 *
 * Hasta acá los problemas aparecían al apretar Guardar o Publicar: el operador
 * dibujaba veinte minutos y recién entonces se enteraba de que una opción no llevaba
 * a ningún lado. Ahora se calculan en el momento, con la MISMA función que corre en
 * el servidor (`validateGraph`), así que lo que el header dice y lo que Publicar
 * responde no pueden divergir.
 *
 * Hay dos severidades y la distinción importa:
 *
 *   blocking  lo que el servidor rechaza al publicar. Es la lista autoritativa.
 *   warning   lo que el editor ve y el servidor no puede ver: una opción sin texto
 *             —que el servidor completa con el id interno antes de validar, así que
 *             le llega "arreglada" y el cliente terminaría viendo un botón que dice
 *             `opcion_2`— o una flecha que quedó atada a una opción borrada.
 *
 * Mezclarlas escondería las segundas; contarlas como bloqueantes haría que el
 * header prometa un rechazo que no va a pasar. Se cuentan juntas y se listan
 * separadas.
 */

import { outgoingProblems, type Graph } from '../_editor';
import { normalizeGraph, validateGraph, type GraphIssue } from './graph-contract';

export type IssueSeverity = 'blocking' | 'warning';

export type EditorIssue = GraphIssue & { severity: IssueSeverity };

/**
 * Los problemas de un grafo, como los vería el servidor más los que sólo ve el
 * editor.
 *
 * Se normaliza primero porque es lo que hace la ruta antes de validar: sin eso el
 * editor reportaría cosas que el servidor descarta (una arista hacia un nodo
 * borrado) y el operador perseguiría un problema que no existe.
 */
export function liveIssues(graph: Graph): EditorIssue[] {
  const blocking: EditorIssue[] = validateGraph(normalizeGraph(graph)).map((issue) => ({
    ...issue,
    severity: 'blocking' as const,
  }));

  const warnings: EditorIssue[] = [];
  for (const node of graph.nodes) {
    for (const message of outgoingProblems(graph, node.id)) {
      // Lo que `validateGraph` ya dice sobre este nodo no se repite: dos renglones
      // para el mismo problema hacen dudar de si son dos.
      if (blocking.some((b) => b.nodeId === node.id && b.message === message)) continue;
      warnings.push({ nodeId: node.id, message, severity: 'warning' });
    }
  }

  return [...blocking, ...warnings];
}

/** Los problemas de cada nodo, para pintar la tarjeta. */
export function issuesByNode(issues: readonly EditorIssue[]): Map<string, EditorIssue[]> {
  const byNode = new Map<string, EditorIssue[]>();
  for (const issue of issues) {
    if (!issue.nodeId) continue;
    const list = byNode.get(issue.nodeId) ?? [];
    list.push(issue);
    byNode.set(issue.nodeId, list);
  }
  return byNode;
}

/** Los problemas de cada flecha. */
export function issuesByEdge(issues: readonly EditorIssue[]): Map<string, EditorIssue[]> {
  const byEdge = new Map<string, EditorIssue[]>();
  for (const issue of issues) {
    if (!issue.edgeId) continue;
    const list = byEdge.get(issue.edgeId) ?? [];
    list.push(issue);
    byEdge.set(issue.edgeId, list);
  }
  return byEdge;
}

/**
 * Los que no son de ningún nodo ni de ninguna flecha: "falta una entrada", "no hay
 * catch-all". No se pueden pintar sobre el canvas, así que van al panel del
 * recorrido — si no, el header cuenta problemas que no se ven en ninguna parte.
 */
export function flowLevelIssues(issues: readonly EditorIssue[]): EditorIssue[] {
  return issues.filter((i) => !i.nodeId && !i.edgeId);
}

export type IssueTarget = { kind: 'node' | 'edge'; id: string };

/** Los lugares del canvas que hay que ir a mirar, sin repetir y en orden. */
export function issueTargets(issues: readonly EditorIssue[]): IssueTarget[] {
  const seen = new Set<string>();
  const targets: IssueTarget[] = [];
  for (const issue of issues) {
    const target: IssueTarget | null = issue.nodeId
      ? { kind: 'node', id: issue.nodeId }
      : issue.edgeId
        ? { kind: 'edge', id: issue.edgeId }
        : null;
    if (!target) continue;
    const key = `${target.kind}:${target.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(target);
  }
  return targets;
}

/**
 * El próximo problema a mirar, dando la vuelta al llegar al final.
 *
 * Es lo que hace el badge del header: se toca y el canvas salta al paso que falla.
 * Cicla en vez de frenarse en el último porque el operador arregla de a uno y
 * vuelve a tocar; frenarse lo dejaría pensando que el botón se rompió.
 */
export function nextIssueTarget(
  issues: readonly EditorIssue[],
  current: IssueTarget | null,
): IssueTarget | null {
  const targets = issueTargets(issues);
  if (targets.length === 0) return null;
  if (!current) return targets[0] as IssueTarget;
  const at = targets.findIndex((t) => t.kind === current.kind && t.id === current.id);
  if (at === -1) return targets[0] as IssueTarget;
  return targets[(at + 1) % targets.length] as IssueTarget;
}
