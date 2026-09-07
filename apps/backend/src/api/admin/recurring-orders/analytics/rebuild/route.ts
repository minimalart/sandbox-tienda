import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { computeMetricsForDate, dayRange } from '../../../../../modules/recurring-order/analytics';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 120;

/**
 * POST /admin/recurring-orders/analytics/rebuild?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Re-computa los snapshots del rango (default: últimos 30 días, máx 120).
 * Idempotente. Ojo: los eventos del día se reconstruyen exactos; las columnas
 * de foto de estado usan el estado ACTUAL de las suscripciones.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const toStr = (d: Date) => d.toISOString().slice(0, 10);
  const now = new Date();
  const to = (req.query.to as string | undefined) || toStr(now);
  const from =
    (req.query.from as string | undefined) || toStr(new Date(now.getTime() - 29 * DAY_MS));

  const start = dayRange(from).start.getTime();
  const end = dayRange(to).start.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    res.status(400).json({ message: 'Rango inválido.' });
    return;
  }
  const days = Math.min(Math.floor((end - start) / DAY_MS) + 1, MAX_DAYS);

  let rows = 0;
  for (let i = 0; i < days; i++) {
    const dateStr = toStr(new Date(start + i * DAY_MS));
    const result = await computeMetricsForDate(req.scope, dateStr);
    rows += result.rows;
  }
  res.status(200).json({ from, to, days, rows });
}
