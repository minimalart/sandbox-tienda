import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import {
  aggregateFlowAnalytics,
  type FlowEventRow,
} from '../../../../lib/whatsapp/flow/analytics';
import { normalizeGraph } from '../../../../lib/whatsapp/flow/graph';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { WHATSAPP_EVENT_LOG_MODULE } from '../../../../modules/whatsapp-agent/event-log/types';
import { WHATSAPP_FLOW_MODULE } from '../../../../modules/whatsapp-flow';
import type WhatsappFlowModuleService from '../../../../modules/whatsapp-flow/service';
import { DEFAULT_FLOW_KEY } from '../../../../modules/whatsapp-flow/types';

/**
 * GET /admin/whatsapp-flows/analytics?days=30 — por dónde pasan las conversaciones.
 *
 * El embudo de `whatsapp-analytics` cuenta etapas comerciales y el visor de
 * `whatsapp-sessions` muestra UNA conversación. Esto es lo del medio: cuántas entran a
 * cada paso del recorrido dibujado, por qué rama salen y dónde se caen — la diferencia
 * entre "el bot convierte poco" y "el 60% abandona en la pregunta de la presentación".
 *
 * Se agrega EN MEMORIA y no en SQL por el mismo motivo que sus dos hermanas: el
 * volumen del bot está lejos del techo, y una agregación cruda acá obligaría a
 * duplicar el filtro multitienda en dos lenguajes.
 */

const MAX_ROWS = 20_000;
const DEFAULT_DAYS = 30;

type EventLogService = {
  listWhatsappEvents: (
    filters: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) => Promise<FlowEventRow[]>;
};

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const resolution = await siteFromRequest(req);
  const siteId = resolution.status === 'site' ? resolution.site.id : null;

  const q = req.query as Record<string, string | undefined>;
  const days = Math.min(Math.max(Number(q.days) || DEFAULT_DAYS, 1), 365);
  const since = new Date(Date.now() - days * 86_400_000);
  const flowKey = q.flow_key || DEFAULT_FLOW_KEY;

  const flowService = req.scope.resolve(WHATSAPP_FLOW_MODULE) as WhatsappFlowModuleService;

  /**
   * Contra qué grafo se miden los números.
   *
   * Por default la versión ACTIVA, que es la que corrió: medir contra el borrador
   * mostraría cero en los pasos que todavía no atendieron a nadie y daría la
   * impresión de que el recorrido no funciona.
   */
  const version = q.version_id
    ? ((await flowService.retrieveWhatsappFlowVersion(q.version_id).catch(() => null)) as {
        id: string;
        site_id: string | null;
        graph: unknown;
      } | null)
    : await flowService.getActiveVersion(flowKey, siteId);

  if (!version || (version.site_id ?? '') !== (siteId ?? '')) {
    res.json({ available: false, reason: 'Todavía no hay una versión publicada para medir.' });
    return;
  }

  let eventService: EventLogService;
  try {
    eventService = req.scope.resolve(WHATSAPP_EVENT_LOG_MODULE) as EventLogService;
  } catch {
    res.json({ available: false, reason: 'El módulo de eventos de WhatsApp no está registrado.' });
    return;
  }

  // Los eventos sin tienda son de antes de que se propagara la columna: se muestran en
  // todas en vez de esconderse. Mismo criterio que el embudo — mostrar de más es
  // recuperable, esconder no.
  const siteFilter = siteId ? { $or: [{ site_id: siteId }, { site_id: null }] } : {};

  const rows = await eventService.listWhatsappEvents(
    { type: 'node_entered', created_at: { $gte: since }, ...siteFilter },
    { take: MAX_ROWS, order: { created_at: 'ASC' } },
  );

  const graph = normalizeGraph(version.graph);
  const stats = aggregateFlowAnalytics(rows, graph, version.id);

  res.json({
    available: true,
    days,
    since: since.toISOString(),
    version_id: version.id,
    rows_read: rows.length,
    truncated: rows.length >= MAX_ROWS,
    ...stats,
  });
}
