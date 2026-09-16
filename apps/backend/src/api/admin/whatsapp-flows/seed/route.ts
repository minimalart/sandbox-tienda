import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { validateGraph } from '../../../../lib/whatsapp/flow/graph';
import { SEED_GRAPH } from '../../../../lib/whatsapp/flow/seed';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { WHATSAPP_FLOW_MODULE } from '../../../../modules/whatsapp-flow';
import type WhatsappFlowModuleService from '../../../../modules/whatsapp-flow/service';
import { DEFAULT_FLOW_KEY } from '../../../../modules/whatsapp-flow/types';

/**
 * POST /admin/whatsapp-flows/seed — carga el recorrido que el bot atiende hoy.
 *
 * Un canvas vacío es una pantalla en la que nadie sabe por dónde empezar. Esto
 * deja el menú, la compra, el asesor y el estado de pedido ya dibujados, con los
 * mismos textos que el router viejo, para editar sobre algo reconocible.
 *
 * **Nunca pisa un borrador existente** salvo con `{ force: true }`: apretar el
 * botón dos veces no puede borrar media hora de canvas. Y no publica nada — el
 * grafo semilla queda como borrador hasta que alguien lo revise.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(WHATSAPP_FLOW_MODULE) as WhatsappFlowModuleService;
  const resolution = await siteFromRequest(req);
  const siteId = resolution.status === 'site' ? resolution.site.id : null;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const flowKey = (body.flow_key as string) || DEFAULT_FLOW_KEY;

  /**
   * Siempre CREA uno nuevo, sin preguntar.
   *
   * Antes devolvía 409 si ya había un borrador y pedía `force` para pisarlo, porque
   * sólo podía existir uno. Ahora pueden convivir: el recorrido de ejemplo aparece al
   * lado de lo que ya estaba en vez de reemplazarlo, y no hay nada que confirmar
   * porque no se pierde nada.
   */
  const draft = await service.saveDraft({
    flowKey,
    siteId,
    graph: SEED_GRAPH,
    name: 'Recorrido base',
    notes: 'Cargado desde el recorrido que el bot atiende hoy.',
  });

  res.json({ draft: { ...draft, graph: SEED_GRAPH }, issues: validateGraph(SEED_GRAPH) });
}
