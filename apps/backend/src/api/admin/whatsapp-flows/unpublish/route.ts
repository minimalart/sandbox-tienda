import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { normalizeGraph } from '../../../../lib/whatsapp/flow/graph';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertRowInSite } from '../../../../lib/multistore/scope';
import { WHATSAPP_FLOW_MODULE } from '../../../../modules/whatsapp-flow';
import type WhatsappFlowModuleService from '../../../../modules/whatsapp-flow/service';
import { unpublishFlowVersion } from '../../../../modules/whatsapp-flow/swap';
import { DEFAULT_FLOW_KEY } from '../../../../modules/whatsapp-flow/types';

/**
 * POST /admin/whatsapp-flows/unpublish — el bot deja de atender con el recorrido.
 *
 * La contracara de `publish`. Existía publicar y no existía apagar: la única salida
 * de `active` era publicar OTRA versión, así que un recorrido a medio terminar se
 * quedaba atendiendo el único número de la tienda. Despublicar devuelve el turno al
 * camino de siempre (router determinístico y agente), que es exactamente lo que el
 * webhook hace cuando no hay grafo publicado.
 *
 * DEJA UNA COPIA EN UN BORRADOR, y no devuelve la versión publicada a `draft`.
 * Un borrador es editable, y `saveDraft` pisa el grafo del que se le pida: devolver
 * ahí una versión que YA atendió clientes dejaría la traza de esas conversaciones
 * —`node_entered` guarda el `version_id`— apuntando a un dibujo que nunca corrió.
 * Es el mismo criterio de Restaurar, que tampoco pisa: la histórica queda intacta en
 * el historial y lo que se sigue editando es la copia.
 *
 * ESCRIBE a partir de un id, así que el guard de tienda no es opcional.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(WHATSAPP_FLOW_MODULE) as WhatsappFlowModuleService;
  const resolution = await siteFromRequest(req);
  const siteId = resolution.status === 'site' ? resolution.site.id : null;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const flowKey = (body.flow_key as string) || DEFAULT_FLOW_KEY;

  const active = await service.getActiveVersion(flowKey, siteId);
  if (!active) {
    // Apretar dos veces no es un error, pero tampoco es un éxito mudo: la pantalla
    // tiene que poder decir "ya no había nada publicado".
    res.json({ unpublished_version_id: null, draft: null, already_off: true });
    return;
  }

  /**
   * El `version_id` que manda la pantalla tiene que ser el que se está viendo.
   *
   * Sin esta comparación, apretar Despublicar sobre una lista vieja apagaría lo que
   * se publicó mientras tanto — y de un recorrido que atiende clientes no se apaga
   * "el que haya". Va como opcional para no romper un llamado sin cuerpo.
   */
  const pedido = typeof body.version_id === 'string' ? body.version_id : null;
  if (pedido && pedido !== active.id) {
    res.status(409).json({
      message: 'El recorrido publicado cambió: recargá la pantalla antes de despublicar.',
    });
    return;
  }

  assertRowInSite(active, resolution, {
    kind: 'site_column',
    table: 'whatsapp_flow_version',
    column: 'site_id',
    empty: 'global',
  });

  /**
   * El ámbito de la FILA, no el del request — igual que `publish`.
   *
   * Parado en una tienda, el recorrido que la atiende puede ser el GENERAL. Apagarlo
   * apaga el de todas las tiendas sin recorrido propio, y eso es lo que corresponde
   * hacer (es el que está atendiendo), pero tiene que quedar dicho en la respuesta
   * para que la pantalla lo avise ANTES y no lo descubra después.
   */
  const result = await unpublishFlowVersion(req.scope, {
    flow_key: flowKey,
    site_id: active.site_id ?? null,
  });

  const graph = normalizeGraph(active.graph);
  /**
   * La copia se crea en la tienda del REQUEST, no en la de la fila: despublicar el
   * general desde una tienda deja la copia para seguir editándola ahí, sin volver a
   * tocar lo que era de todas. Misma regla que Restaurar.
   */
  const draft = await service.saveDraft({
    flowKey,
    siteId,
    graph,
    name: active.name,
    notes: `Despublicada desde la versión ${active.version}.`,
  });

  res.json({
    ...result,
    was_global: (active.site_id ?? null) === null,
    draft: { ...draft, graph },
  });
}
