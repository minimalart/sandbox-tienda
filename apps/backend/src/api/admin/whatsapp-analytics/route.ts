import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import {
  WHATSAPP_EVENT_LOG_MODULE,
  type WaEventType,
} from '../../../modules/whatsapp-agent/event-log/types';

import { siteFromRequest } from '../../../lib/multistore/request';

/**
 * Embudo comercial del bot de WhatsApp (PRD §27).
 *
 *   conversación → búsqueda → productos mostrados → producto agregado
 *   → carrito revisado → checkout generado
 *
 * Se cuenta por SESIÓN, no por evento: lo que interesa es cuántas conversaciones
 * de compra llegaron a cada paso (el KPI principal del PRD es el porcentaje que
 * genera un link de checkout). Los eventos anteriores al estado de sesión no
 * tienen `session_id` y se agrupan por teléfono + día; se informan aparte para que
 * no parezcan sesiones reales.
 *
 *   GET /admin/whatsapp-analytics?days=30
 */

type AnyRecord = Record<string, any>;

type EventRow = {
  phone: string;
  session_id: string | null;
  type: WaEventType;
  step: string | null;
  payload: AnyRecord | null;
  used_ai: boolean;
  created_at: string | Date;
};

/** Etapas del embudo, en orden, con los eventos que las marcan. */
const FUNNEL: Array<{ key: string; label: string; events: WaEventType[] }> = [
  { key: 'conversations', label: 'Conversaciones', events: ['inbound'] },
  { key: 'searched', label: 'Búsqueda o asesor', events: ['search', 'guided_started'] },
  { key: 'products_shown', label: 'Productos mostrados', events: ['products_shown'] },
  { key: 'added', label: 'Producto agregado', events: ['added_to_cart'] },
  { key: 'reviewed', label: 'Carrito revisado', events: ['cart_reviewed'] },
  { key: 'checkout', label: 'Checkout generado', events: ['checkout_generated'] },
];

/** Tope de filas leídas: acota el request sin necesidad de SQL agregado. */
const MAX_ROWS = 20_000;

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  let service: AnyRecord;
  try {
    service = req.scope.resolve(WHATSAPP_EVENT_LOG_MODULE) as AnyRecord;
  } catch {
    res.json({ available: false, reason: 'El módulo de eventos de WhatsApp no está registrado.' });
    return;
  }

  const q = req.query as Record<string, string | undefined>;
  const days = Math.min(Math.max(Number(q.days) || 30, 1), 365);
  const since = new Date(Date.now() - days * 86_400_000);

  /**
   * La tienda que RECIBIÓ los mensajes.
   *
   * Se incluyen los eventos sin tienda (`null`): son los anteriores a la columna y los
   * de cuentas de Kapso que todavía apuntan a la URL de webhook sin `?site=`.
   * Esconderlos haría que el embudo no cierre con los mensajes reales, y ahí el
   * operador deja de creerle al tablero.
   */
  const resolution = await siteFromRequest(req);
  // `$or` y no `[id, null]`: el array se emite como `IN (..., NULL)`, que no matchea
  // `IS NULL`, así que los eventos sin tienda —los que este comentario dice incluir a
  // propósito— se caían del embudo. Mismo arreglo que en `siteColumnFilter`.
  const siteFilterForEvents =
    resolution.status === 'site'
      ? { $or: [{ site_id: resolution.site.id }, { site_id: null }] }
      : {};

  const rows = (await service.listWhatsappEvents(
    { created_at: { $gte: since }, ...siteFilterForEvents },
    { take: MAX_ROWS, order: { created_at: 'ASC' } },
  )) as EventRow[];

  /** Clave de sesión: la real, o teléfono + día para los eventos viejos. */
  const sessionKeyOf = (row: EventRow): string => {
    if (row.session_id) return row.session_id;
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    return `legacy:${row.phone}:${day}`;
  };

  const sessions = new Map<
    string,
    { types: Set<WaEventType>; usedAi: boolean; lastStep: string | null; phone: string }
  >();
  const eventTotals: Record<string, number> = {};
  let legacySessions = 0;

  for (const row of rows) {
    eventTotals[row.type] = (eventTotals[row.type] ?? 0) + 1;
    const key = sessionKeyOf(row);
    let session = sessions.get(key);
    if (!session) {
      session = { types: new Set(), usedAi: false, lastStep: null, phone: row.phone };
      sessions.set(key, session);
      if (!row.session_id) legacySessions++;
    }
    session.types.add(row.type);
    if (row.used_ai) session.usedAi = true;
    // Última pregunta del asesor: sirve para ver dónde abandonan (§27).
    if (row.type === 'guided_answered' && row.step) session.lastStep = row.step;
  }

  const all = [...sessions.values()];
  const total = all.length;

  const funnel = FUNNEL.map((stage) => {
    const count = all.filter((s) => stage.events.some((e) => s.types.has(e))).length;
    return {
      key: stage.key,
      label: stage.label,
      sessions: count,
      percent_of_total: total ? Math.round((count / total) * 1000) / 10 : 0,
    };
  });

  /**
   * Abandono por pregunta: sesiones cuya última respuesta del asesor fue esa
   * dimensión y que NUNCA llegaron a ver productos.
   */
  const abandonedByStep: Record<string, number> = {};
  for (const session of all) {
    if (!session.lastStep) continue;
    if (session.types.has('products_shown')) continue;
    abandonedByStep[session.lastStep] = (abandonedByStep[session.lastStep] ?? 0) + 1;
  }

  const withCheckout = all.filter((s) => s.types.has('checkout_generated'));
  const noAi = all.filter((s) => !s.usedAi);
  const commercial = all.filter((s) =>
    ['search', 'guided_started', 'products_shown', 'added_to_cart'].some((e) =>
      s.types.has(e as WaEventType),
    ),
  );

  res.json({
    available: true,
    days,
    since: since.toISOString(),
    rows_read: rows.length,
    truncated: rows.length >= MAX_ROWS,
    sessions: total,
    legacy_sessions: legacySessions,
    funnel,
    /** KPI principal del PRD: conversaciones de compra que generan checkout. */
    kpi: {
      commercial_sessions: commercial.length,
      checkout_sessions: withCheckout.length,
      checkout_rate:
        commercial.length ? Math.round((withCheckout.length / commercial.length) * 1000) / 10 : 0,
    },
    /** Sesiones resueltas SIN modelo (criterio §30.19). */
    without_ai: {
      sessions: noAi.length,
      percent: total ? Math.round((noAi.length / total) * 1000) / 10 : 0,
    },
    no_results: eventTotals['no_results'] ?? 0,
    handoffs: eventTotals['handoff'] ?? 0,
    // Mensajes que llegaron mientras alguien atendía a mano: el bot los ignoró a
    // propósito. Se muestra aparte porque un bot pausado se ve igual que uno roto.
    paused_drops: eventTotals['paused_drop'] ?? 0,
    errors: eventTotals['error'] ?? 0,
    relaxed: eventTotals['guided_relaxed'] ?? 0,
    abandoned_by_step: abandonedByStep,
    event_totals: eventTotals,
  });
};
