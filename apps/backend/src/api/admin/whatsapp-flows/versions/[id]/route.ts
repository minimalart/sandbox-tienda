import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { normalizeGraph } from '../../../../../lib/whatsapp/flow/graph';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertRowInSite } from '../../../../../lib/multistore/scope';
import { WHATSAPP_FLOW_MODULE } from '../../../../../modules/whatsapp-flow';
import type WhatsappFlowModuleService from '../../../../../modules/whatsapp-flow/service';

/**
 * GET /admin/whatsapp-flows/versions/:id — una versión con su grafo.
 *
 * El listado de `GET /admin/whatsapp-flows` devuelve hasta 50 versiones SIN el grafo
 * a propósito: cada uno puede pesar cientos de KB. Para mirar una vieja —o para
 * restaurarla— hay que pedirla por id, y esto es lo que faltaba para que el historial
 * de versiones sirva de algo más que una lista de fechas.
 *
 * El scope importa: sin chequearlo, alguien con acceso a una tienda leería el
 * recorrido de otra con sólo saber un id — que es lo que un listado filtrado NO
 * impide averiguar. Se usa `assertRowInSite` y no un `if` a mano porque es el guard
 * que el repo audita, y porque tira 404 y no 403: un 403 confirmaría que el id existe
 * en otra tienda.
 *
 * `empty: 'global'` es la misma precedencia que ya usa `getActiveVersion`: una versión
 * sin tienda es la del recorrido general, y toda tienda la puede mirar porque puede
 * ser la que la está atendiendo.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(WHATSAPP_FLOW_MODULE) as WhatsappFlowModuleService;
  const resolution = await siteFromRequest(req);
  const id = req.params.id as string;

  const version = (await service
    .retrieveWhatsappFlowVersion(id)
    .catch(() => null)) as (Record<string, unknown> & { graph: unknown }) | null;

  assertRowInSite(version, resolution, {
    kind: 'site_column',
    table: 'whatsapp_flow_version',
    column: 'site_id',
    empty: 'global',
  });

  res.json({ version: { ...version, graph: normalizeGraph(version?.graph) } });
}

/**
 * DELETE /admin/whatsapp-flows/versions/:id — borra un borrador.
 *
 * Es la "B" del ABM: sin ella, un recorrido que se probó y no sirvió queda en la
 * tabla para siempre, y la tabla deja de decir cuáles son los que importan.
 *
 * SÓLO borradores. La versión publicada es la que está atendiendo clientes en este
 * momento, y una supersedida es el registro de lo que atendió: borrarla dejaría la
 * traza de conversaciones reales apuntando a una fila que no existe. Para dejar de
 * usar la publicada se publica otra, que además deja el historial derecho.
 *
 * El guard de tienda es el mismo del GET y va por `assertRowInSite`: con sólo saber
 * un id, alguien con acceso a una tienda borraría el recorrido de otra. Tira 404 y no
 * 403 porque un 403 confirmaría que el id existe en otra tienda.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(WHATSAPP_FLOW_MODULE) as WhatsappFlowModuleService;
  const resolution = await siteFromRequest(req);
  const id = req.params.id as string;

  const version = (await service
    .retrieveWhatsappFlowVersion(id)
    .catch(() => null)) as (Record<string, unknown> & { status?: string }) | null;

  assertRowInSite(version, resolution, {
    kind: 'site_column',
    table: 'whatsapp_flow_version',
    column: 'site_id',
    empty: 'global',
  });

  if (version?.status !== 'draft') {
    res.status(400).json({
      message: 'Sólo se puede borrar un recorrido en borrador. El publicado se reemplaza publicando otro.',
    });
    return;
  }

  await service.deleteWhatsappFlowVersions([id]);
  res.json({ id, deleted: true });
}

/**
 * POST /admin/whatsapp-flows/versions/:id — le cambia el NOMBRE, y nada más.
 *
 * Ruta propia y no un campo del guardado normal por una razón concreta:
 * `saveDraft` escribe `graph: input.graph` siempre, y `POST /admin/whatsapp-flows`
 * normaliza el cuerpo — así que un renombrado sin grafo lo dejaría VACÍO. Renombrar
 * desde la tabla, donde nadie tiene el grafo a mano, habría borrado el recorrido.
 *
 * Se puede renombrar cualquier versión del alcance, incluida la publicada: el nombre
 * es una etiqueta para el operador y no cambia en nada lo que atiende a los clientes.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(WHATSAPP_FLOW_MODULE) as WhatsappFlowModuleService;
  const resolution = await siteFromRequest(req);
  const id = req.params.id as string;

  const version = (await service
    .retrieveWhatsappFlowVersion(id)
    .catch(() => null)) as Record<string, unknown> | null;

  assertRowInSite(version, resolution, {
    kind: 'site_column',
    table: 'whatsapp_flow_version',
    column: 'site_id',
    empty: 'global',
  });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  if (!name) {
    res.status(400).json({ message: 'El recorrido necesita un nombre.' });
    return;
  }

  await service.updateWhatsappFlowVersions([{ id, name }] as never);
  res.json({ id, name });
}
