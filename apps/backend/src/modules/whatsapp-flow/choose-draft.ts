/**
 * A QUÉ FILA ESCRIBE UN GUARDADO.
 *
 * Es una línea, pero es la línea que puede destruir trabajo ajeno, así que vive
 * aparte y con test. Mientras hubo UN borrador por tienda, "guardar" tenía un solo
 * destino posible y no había nada que decidir. Desde que conviven varios, elegir mal
 * significa una de dos cosas, las dos irreversibles: guardar un recorrido encima de
 * otro, o pisarle el grafo a una versión que ya atendió clientes de verdad — y con
 * ella, dejar la traza de esas conversaciones apuntando a un dibujo que nunca corrió.
 */

/** Lo poco que hace falta saber de la fila que el cliente pidió escribir. */
export type DraftCandidate = {
  status?: string | null;
  site_id?: string | null;
} | null;

/** `null` (instancia) y `''` comparan igual, como en el índice único de la base. */
const siteKey = (siteId: string | null | undefined): string => siteId ?? '';

/**
 * `'update'` sólo cuando la fila pedida es un borrador DE ESTA TIENDA. Todo lo demás
 * —no existe, es la publicada, es de otra tienda, no se pidió ninguna— cae en
 * `'create'`, que nunca pierde nada: en el peor caso deja un borrador de más.
 */
export function chooseDraftTarget(
  candidate: DraftCandidate,
  siteId: string | null,
): 'update' | 'create' {
  if (!candidate) return 'create';
  if (candidate.status !== 'draft') return 'create';
  if (siteKey(candidate.site_id) !== siteKey(siteId)) return 'create';
  return 'update';
}
