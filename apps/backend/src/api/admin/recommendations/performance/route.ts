import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteChannelFilter } from '../../../../lib/multistore/scope';
import { RECOMMENDATION_ENGINE_MODULE } from '../../../../modules/recommendations';
import {
  groupMetrics,
  summarizeMetrics,
  timeSeries,
  type MetricRow,
} from '../../../../modules/recommendations/events/performance';
import type RecommendationEngineModuleService from '../../../../modules/recommendations/service';

/**
 * GET /admin/recommendations/performance — pantalla de Rendimiento (PRD §16.3).
 *
 * Lee SÓLO métricas agregadas, nunca eventos crudos: un rango de un mes sobre la tabla de
 * eventos sería un scan de millones de filas en el camino de un request de admin.
 *
 * Query: `from`, `to` (ISO), `bucket` (daily|hourly), `placement`, `strategy_key`,
 * `sales_channel_id`.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(
    RECOMMENDATION_ENGINE_MODULE,
  ) as unknown as RecommendationEngineModuleService;

  const asString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() !== '' ? value : undefined;

  const bucket = asString(req.query.bucket) === 'hourly' ? 'hourly' : 'daily';
  const to = asString(req.query.to) ? new Date(String(req.query.to)) : new Date();
  const from = asString(req.query.from)
    ? new Date(String(req.query.from))
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    res.status(400).json({ message: 'Rango de fechas inválido.' });
    return;
  }

  const filters: Record<string, unknown> = {
    bucket,
    period_start: { $gte: from, $lte: to },
  };
  const placement = asString(req.query.placement);
  const strategyKey = asString(req.query.strategy_key);
  const salesChannelId = asString(req.query.sales_channel_id);
  if (placement) filters.placement = placement;
  if (strategyKey) filters.strategy_key = strategyKey;
  /**
   * La tienda activa pasa a ser el DEFAULT; el parámetro explícito sigue ganando.
   *
   * Y filtra por LOS DOS canales de una tienda B2B, no por uno: hasta ahora una
   * tienda mayorista veía la mitad de sus métricas sin ninguna señal de que faltaba
   * algo — los números daban bajos y parecían un problema de negocio.
   */
  Object.assign(filters, siteChannelFilter(await siteFromRequest(req), salesChannelId));

  const rows = (await service.listRecommendationMetrics(filters, {
    take: 5000,
    order: { period_start: 'ASC' },
  })) as unknown as MetricRow[];

  // Cache-Control privado: son datos comerciales por tienda.
  res.setHeader('Cache-Control', 'private, no-store');

  res.status(200).json({
    range: { from: from.toISOString(), to: to.toISOString(), bucket },
    totals: summarizeMetrics(rows),
    series: timeSeries(rows),
    by_placement: groupMetrics(rows, 'placement'),
    by_strategy: groupMetrics(rows, 'resolved_strategy_key'),
    meta: {
      source: 'aggregated_metrics',
      rows_scanned: rows.length,
      // Si esto queda vacío con eventos ya registrados, lo que falta es que corra el job
      // de agregación: es la causa nº1 de "la pantalla no muestra nada".
      hint: rows.length === 0 ? 'Sin métricas agregadas todavía en el rango elegido.' : null,
    },
  });
}
