import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { normalizeGraph, validateGraph } from '../../../../../../lib/whatsapp/flow/graph';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertRowInSite } from '../../../../../../lib/multistore/scope';
import { WHATSAPP_FLOW_MODULE } from '../../../../../../modules/whatsapp-flow';
import type WhatsappFlowModuleService from '../../../../../../modules/whatsapp-flow/service';
import { DEFAULT_FLOW_KEY } from '../../../../../../modules/whatsapp-flow/types';

/**
 * POST /admin/whatsapp-flows/versions/:id/restore — trae una versión vieja al borrador.
 *
 * Publicar reemplaza lo que atiende a todos los clientes, y hasta acá volver atrás
 * significaba redibujar a mano. Las versiones supersedidas se conservan desde el
 * principio; lo que faltaba era la forma de traer una de vuelta.
 *
 * NO PUBLICA: deja el borrador cargado para que alguien lo mire antes. Y no pisa un
 * borrador existente salvo con `force: true`, igual que `seed`: apretar "restaurar"
 * por curiosidad no puede borrar media hora de canvas.
 *
 * ESCRIBE a partir de un id, así que el guard de tienda no es opcional: sin él,
 * alguien con acceso a una tienda podría traerse el recorrido de otra con sólo saber
 * un id. Se usa `assertRowInSite` —el guard que el repo audita— y no un `if` a mano.
 *
 * El borrador que se crea es SIEMPRE el de la tienda del request: restaurar una
 * versión del recorrido general desde una tienda la copia a la tienda, no la pisa.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(WHATSAPP_FLOW_MODULE) as WhatsappFlowModuleService;
  const resolution = await siteFromRequest(req);
  const siteId = resolution.status === 'site' ? resolution.site.id : null;
  const id = req.params.id as string;

  const version = (await service.retrieveWhatsappFlowVersion(id).catch(() => null)) as
    | (Record<string, unknown> & { flow_key: string; version: number; graph: unknown })
    | null;

  assertRowInSite(version, resolution, {
    kind: 'site_column',
    table: 'whatsapp_flow_version',
    column: 'site_id',
    empty: 'global',
  });

  if (!version) {
    res.status(404).json({ message: 'No existe esa versión del recorrido.' });
    return;
  }

  const flowKey = version.flow_key || DEFAULT_FLOW_KEY;
  /**
   * Restaurar CREA un borrador nuevo, sin pisar ninguno.
   *
   * Antes devolvía 409 y pedía `force` porque sólo podía haber un borrador; desde que
   * pueden convivir, la versión vieja aparece como un recorrido más y lo que se
   * estaba editando sigue donde estaba.
   */
  const graph = normalizeGraph(version.graph);
  const draft = await service.saveDraft({
    flowKey,
    siteId,
    graph,
    notes: `Restaurada desde la versión ${version.version}.`,
  });

  res.json({ draft: { ...draft, graph }, issues: validateGraph(graph) });
}
