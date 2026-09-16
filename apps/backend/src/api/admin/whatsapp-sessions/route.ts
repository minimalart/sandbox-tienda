import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { siteFromRequest } from '../../../lib/multistore/request';
import { WHATSAPP_EVENT_LOG_MODULE } from '../../../modules/whatsapp-agent/event-log/types';

/**
 * Los recorridos de los clientes por el bot.
 *
 *   GET /admin/whatsapp-sessions              → una fila por conversación
 *   GET /admin/whatsapp-sessions?session_id=… → el timeline de esa conversación
 *
 * Hasta acá el event log sólo se leía agregado por el embudo: no había forma de
 * ver UN recorrido. Eso es lo que el operador necesita cuando alguien escribe
 * "el bot no me contestó" — y lo que hace falta para pintar el camino recorrido
 * sobre el canvas del editor.
 *
 * Se agrega en memoria y no en SQL por la misma razón que `whatsapp-analytics`:
 * el volumen del bot está lejos del techo, y una agregación cruda acá obligaría a
 * duplicar el filtro multitienda en dos lenguajes.
 */

type EventRow = {
  id: string;
  phone: string;
  session_id: string | null;
  type: string;
  step: string | null;
  payload: Record<string, unknown> | null;
  used_ai: boolean;
  site_id: string | null;
  seq: number | null;
  created_at: string;
};

type EventLogService = {
  listWhatsappEvents: (
    filters: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) => Promise<EventRow[]>;
};

/** Tope duro: el mismo criterio que el embudo, para no barrer la tabla entera. */
const MAX_ROWS = 20_000;
const DEFAULT_DAYS = 7;

/**
 * `(created_at, seq)`. `created_at` solo no alcanza: los eventos se emiten
 * fire-and-forget y varios de un turno comparten milisegundo, así que el timeline
 * salía con las decisiones del bot invertidas.
 */
const byEmission = (a: EventRow, b: EventRow): number => {
  const at = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  if (at !== 0) return at;
  return (a.seq ?? 0) - (b.seq ?? 0);
};

/** El desenlace del recorrido, en el orden en que importa contarlo. */
function outcomeOf(events: EventRow[]): string {
  const types = new Set(events.map((e) => e.type));
  if (types.has('checkout_generated')) return 'checkout';
  if (types.has('handoff')) return 'handoff';
  if (types.has('added_to_cart')) return 'carrito';
  if (types.has('error')) return 'error';
  if (types.has('products_shown')) return 'productos';
  if (types.has('no_results')) return 'sin_resultados';
  return 'abierta';
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(WHATSAPP_EVENT_LOG_MODULE) as EventLogService;
  const resolution = await siteFromRequest(req);
  const siteId = resolution.status === 'site' ? resolution.site.id : null;

  const q = req.query as Record<string, string | undefined>;
  const sessionId = q.session_id;
  const days = Math.min(Math.max(Number(q.days) || DEFAULT_DAYS, 1), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Los eventos sin `site_id` son de antes de que se propagara: se muestran en
  // todas las tiendas en vez de esconderse. Mismo criterio que el embudo — mostrar
  // de más es recuperable, esconder no.
  const siteFilter = siteId ? { $or: [{ site_id: siteId }, { site_id: null }] } : {};

  // ── El timeline de UNA conversación ─────────────────────────────────────────
  if (sessionId) {
    const rows = await service.listWhatsappEvents(
      { session_id: sessionId, ...siteFilter },
      { take: 2000, order: { created_at: 'ASC' } },
    );
    const events = [...rows].sort(byEmission);
    res.json({
      session_id: sessionId,
      phone: events[0]?.phone ?? null,
      outcome: outcomeOf(events),
      // Los nodos por los que pasó, en orden y sin repetir consecutivos: es lo que
      // el editor resalta sobre el canvas.
      path: events
        .filter((e) => e.type === 'node_entered')
        .map((e) => e.step ?? (e.payload?.node_id as string) ?? '')
        .filter(Boolean),
      version_id:
        events.find((e) => e.type === 'node_entered')?.payload?.version_id ?? null,
      events,
    });
    return;
  }

  // ── La lista de recorridos ──────────────────────────────────────────────────
  const rows = await service.listWhatsappEvents(
    { created_at: { $gte: since }, ...siteFilter },
    { take: MAX_ROWS, order: { created_at: 'ASC' } },
  );

  const grouped = new Map<string, EventRow[]>();
  for (const row of rows) {
    // Sin `session_id` el evento es anterior al fix de correlación: se agrupa por
    // teléfono y día para que siga siendo visible en vez de desaparecer.
    const key = row.session_id ?? `legacy:${row.phone}:${row.created_at.slice(0, 10)}`;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const sessions = [...grouped.entries()]
    .map(([key, events]) => {
      const sorted = [...events].sort(byEmission);
      const first = sorted[0] as EventRow;
      const last = sorted[sorted.length - 1] as EventRow;
      return {
        session_id: key,
        legacy: !first.session_id,
        phone: first.phone,
        started_at: first.created_at,
        last_at: last.created_at,
        events: sorted.length,
        nodes: sorted.filter((e) => e.type === 'node_entered').length,
        used_ai: sorted.some((e) => e.used_ai),
        outcome: outcomeOf(sorted),
        site_id: first.site_id,
      };
    })
    .sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());

  res.json({
    days,
    rows_read: rows.length,
    truncated: rows.length >= MAX_ROWS,
    sessions,
  });
}
