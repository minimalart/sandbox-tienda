import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { normalizeGraph, validateGraph } from '../../../../lib/whatsapp/flow/graph';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { WHATSAPP_FLOW_MODULE } from '../../../../modules/whatsapp-flow';
import type WhatsappFlowModuleService from '../../../../modules/whatsapp-flow/service';
import { publishFlowVersion } from '../../../../modules/whatsapp-flow/swap';
import { DEFAULT_FLOW_KEY } from '../../../../modules/whatsapp-flow/types';

/**
 * POST /admin/whatsapp-flows/publish — el borrador pasa a atender clientes.
 *
 * Es el único momento en que se valida DE VERDAD: un grafo con un botón que no
 * lleva a ningún lado se puede guardar, pero no publicar. El error se devuelve con
 * la lista completa de problemas para que el editor los pinte sobre los nodos.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(WHATSAPP_FLOW_MODULE) as WhatsappFlowModuleService;
  const resolution = await siteFromRequest(req);
  const siteId = resolution.status === 'site' ? resolution.site.id : null;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const flowKey = (body.flow_key as string) || DEFAULT_FLOW_KEY;

  /**
   * QUÉ borrador se publica.
   *
   * Lo dice el cliente por `version_id`, porque desde que hay varios "el borrador" ya
   * no identifica a ninguno. Sin id se publica el único que haya — y si hay más de
   * uno se pide que lo aclare en vez de elegir por él, que sería poner a atender
   * clientes un recorrido que nadie eligió.
   *
   * Se verifica que sea un borrador DE ESTA TIENDA: con sólo saber un id, alguien con
   * acceso a una tienda publicaría el recorrido de otra. Y que esté en borrador: una
   * versión supersedida se vuelve a poner a atender con Restaurar, que deja el
   * historial derecho.
   */
  const pedido = typeof body.version_id === 'string' ? body.version_id : null;
  /**
   * Los generales entran porque son publicables desde una tienda: son el recorrido
   * que la atiende. Lo que NO se puede es publicarlos en el ámbito equivocado, así
   * que el swap se hace con el `site_id` de la FILA y no con el de la request —
   * publicar el general lo deja activo como general, para todas.
   */
  const borradores = await service.listDrafts(flowKey, siteId, { includeGlobal: true });
  const draft = pedido ? borradores.find((d) => d.id === pedido) ?? null : borradores[0] ?? null;

  if (!draft) {
    res.status(404).json({
      message: pedido
        ? 'Ese borrador no existe en esta tienda, o ya no está en borrador.'
        : 'No hay un borrador para publicar.',
    });
    return;
  }
  if (!pedido && borradores.length > 1) {
    res.status(400).json({ message: 'Hay varios borradores: decí cuál publicar.' });
    return;
  }

  const graph = normalizeGraph(draft.graph);
  const issues = validateGraph(graph);
  if (issues.length > 0) {
    res.status(400).json({
      message: 'El grafo tiene problemas que hay que resolver antes de publicarlo.',
      issues,
    });
    return;
  }

  /**
   * `exclusive` y las notas se guardan ANTES del swap: si se guardaran después, un
   * turno que entre entre las dos escrituras vería el grafo activo sin la marca.
   *
   * Las notas son lo que después deja entender el historial: una lista de fechas no
   * dice por qué se publicó cada versión, y sin eso "volver a la anterior" es elegir
   * a ciegas.
   */
  const cambios: Record<string, unknown> = { id: draft.id };
  if (typeof body.exclusive === 'boolean') {
    cambios.metadata = { ...(draft as { metadata?: object }).metadata, exclusive: body.exclusive };
  }
  if (typeof body.notes === 'string' && body.notes.trim()) cambios.notes = body.notes.trim();
  if (Object.keys(cambios).length > 1) {
    await service.updateWhatsappFlowVersions([cambios] as never);
  }

  const result = await publishFlowVersion(req.scope, {
    version_id: draft.id,
    flow_key: flowKey,
    /**
     * El ámbito de la FILA, no el de la request. Publicar el borrador general desde
     * una tienda lo deja activo como general —que es lo que es— en vez de dejar dos
     * activos, uno por ámbito, y que `getActiveVersion` elija en silencio.
     */
    site_id: draft.site_id ?? null,
    published_by: req.auth_context?.actor_id ?? null,
  });

  const active = await service.getActiveVersion(flowKey, siteId);
  res.json({ ...result, active: active ? { ...active, graph: normalizeGraph(active.graph) } : null });
}
