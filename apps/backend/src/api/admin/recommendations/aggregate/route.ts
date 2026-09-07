import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { aggregateRecommendationMetrics } from '../../../../modules/recommendations/events/aggregate';

/**
 * POST /admin/recommendations/aggregate — recalcula métricas de una ventana.
 *
 * Es el botón "actualizar métricas" de la pantalla de Rendimiento, para no esperar al job
 * horario. Es idempotente (delete-then-insert por período), así que se puede apretar las
 * veces que sea.
 *
 * Body opcional: `{ bucket, from, to }`. Por defecto, últimas 48 horas en horario y los
 * últimos 2 días en diario, igual que el job.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const body = (req.body ?? {}) as { bucket?: string; from?: string; to?: string };

  const bucket = body.bucket === 'hourly' ? 'hourly' : 'daily';
  const to = body.to ? new Date(body.to) : new Date();
  const defaultSpanMs = bucket === 'hourly' ? 48 * 60 * 60 * 1000 : 2 * 24 * 60 * 60 * 1000;
  const from = body.from ? new Date(body.from) : new Date(to.getTime() - defaultSpanMs);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    res.status(400).json({ message: 'Rango de fechas inválido.' });
    return;
  }

  const result = await aggregateRecommendationMetrics(req.scope, { bucket, from, to });
  // 202: el recálculo ya corrió, pero se responde como "aceptado" para dejar claro que la
  // pantalla se refresca leyendo, no con este payload.
  res.status(202).json(result);
}
