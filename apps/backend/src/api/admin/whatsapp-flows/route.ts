import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { normalizeGraph, validateGraph } from '../../../lib/whatsapp/flow/graph';
import { siteFromRequest } from '../../../lib/multistore/request';
import { WHATSAPP_FLOW_MODULE } from '../../../modules/whatsapp-flow';
import type WhatsappFlowModuleService from '../../../modules/whatsapp-flow/service';
import { DEFAULT_FLOW_KEY } from '../../../modules/whatsapp-flow/types';

/**
 * El grafo de conversación del bot.
 *
 *   GET  /admin/whatsapp-flows   → los recorridos de la tienda (publicado + borradores)
 *   POST /admin/whatsapp-flows   → crea un borrador, o guarda uno con `version_id`
 *
 * Guardar y publicar están separados a propósito: el editor guarda seguido —cada
 * vez que se arrastra un nodo— y publicar es lo único que cambia lo que atiende a
 * los clientes.
 *
 * Sin zod ni middlewares, igual que la ruta del asesor: lo que llega del canvas
 * puede ser de una versión anterior del formato, y rechazar el guardado entero por
 * un campo que sobra le haría perder el trabajo al operador. `normalizeGraph` tira
 * lo que no entiende y `validateGraph` reporta los problemas reales sin borrar
 * nada. Registrar middlewares además obligaría a regenerar
 * `api/extension-middlewares.ts`, que es un archivo generado.
 */

/** `null` = el flujo GLOBAL, el que usa toda tienda sin uno propio. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

const svc = (req: MedusaRequest): WhatsappFlowModuleService =>
  req.scope.resolve(WHATSAPP_FLOW_MODULE) as WhatsappFlowModuleService;

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = svc(req);
  const siteId = await siteOf(req);
  const flowKey = (req.query?.flow_key as string) || DEFAULT_FLOW_KEY;

  /**
   * Los generales también. Una tienda sin recorrido propio la atiende el general, así
   * que esconderlo es esconder el recorrido que está atendiendo a sus clientes — y es
   * lo que hacía que un recorrido "desapareciera" al elegir una tienda.
   */
  const [drafts, active] = await Promise.all([
    service.listDrafts(flowKey, siteId, { includeGlobal: true }),
    service.getActiveVersion(flowKey, siteId),
  ]);

  const history = (await service.listWhatsappFlowVersions(
    { flow_key: flowKey },
    { take: 50, order: { version: 'DESC' } },
  )) as unknown as Array<Record<string, unknown>>;

  /**
   * El historial se filtra por tienda, con la MISMA precedencia que `getActiveVersion`:
   * las de esta tienda y las del recorrido general, que son las que pueden estar
   * atendiéndola. Sin el filtro, una tienda veía en su historial las versiones de las
   * otras —fechas, notas y números de versión ajenos— y podía pedir restaurar una que
   * la ruta después rechaza con un 404 que no explica nada.
   */
  const siteKey = (value: unknown): string => (typeof value === 'string' ? value : '');
  const propias = history.filter(
    (row) => siteKey(row.site_id) === siteKey(siteId) || siteKey(row.site_id) === '',
  );

  /**
   * La fila de la tabla: sin el grafo, pero con lo que se lee de un vistazo.
   *
   * `steps` y `problems` se cuentan ACÁ y no en el cliente porque mandar el grafo de
   * cada recorrido sólo para contar sus nodos son cientos de KB por fila. Y son las
   * dos cosas que hacen la tabla útil: cuál está vacío y cuál no se va a poder
   * publicar todavía.
   */
  const fila = (row: Record<string, unknown>) => {
    const graph = normalizeGraph(row.graph);
    const { graph: _graph, ...rest } = row;
    return { ...rest, steps: graph.nodes.length, problems: validateGraph(graph).length };
  };

  res.json({
    flow_key: flowKey,
    site_id: siteId,
    // El grafo se devuelve normalizado: el editor no tiene que defenderse de lo
    // que guardó una versión anterior del propio editor.
    active: active ? { ...active, graph: normalizeGraph(active.graph) } : null,
    /**
     * VARIOS borradores. Cada uno es un recorrido en armado; el que se publique pasa
     * a ser el único que atiende clientes y el anterior queda como historia.
     */
    drafts: drafts.map((d) => fila(d as unknown as Record<string, unknown>)),
    // El historial va SIN el grafo: son hasta 50 filas y cada grafo puede pesar
    // cientos de KB. Para ver uno viejo se pide por id.
    versions: propias.map(({ graph: _graph, ...rest }) => rest),
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = svc(req);
  const siteId = await siteOf(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const flowKey = (body.flow_key as string) || DEFAULT_FLOW_KEY;

  const graph = normalizeGraph(body.graph);
  const issues = validateGraph(graph);

  /**
   * Sin `version_id` se CREA uno nuevo; con él se guarda ese.
   *
   * El id lo manda siempre el editor, que lo tiene desde que abrió el recorrido.
   * Elegir por su cuenta a cuál escribir —como hacía antes, cuando sólo podía haber
   * uno— ahora sería guardar un recorrido encima de otro.
   *
   * Se guarda IGUAL con problemas: un borrador es trabajo en curso, y obligar a
   * dejarlo consistente antes de poder guardar es la forma más rápida de que alguien
   * pierda media hora de canvas. Publicar sí los exige.
   */
  const draft = await service.saveDraft({
    versionId: typeof body.version_id === 'string' ? body.version_id : null,
    flowKey,
    siteId,
    graph,
    name: typeof body.name === 'string' ? body.name : undefined,
    notes: typeof body.notes === 'string' ? body.notes : undefined,
  });

  res.json({ draft: { ...draft, graph }, issues });
}
