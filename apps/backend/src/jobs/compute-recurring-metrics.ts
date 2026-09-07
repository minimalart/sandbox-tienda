import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { computeMetricsForDate } from '../modules/recurring-order/analytics';
import { getRecurringOrderConfig } from '../modules/recurring-order/config';

/**
 * Snapshot diario de métricas de compras recurrentes (por canal + global).
 * Corre a las 03:00 UTC y computa el día ANTERIOR completo; también re-computa
 * el día actual para que el dashboard intradía no quede en cero. Idempotente
 * (upsert por date+canal): re-correrlo no duplica.
 */
export default async function computeRecurringMetricsJob(
  container: MedusaContainer,
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  if (!getRecurringOrderConfig().enabled) return;

  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

  for (const dateStr of [toDateStr(yesterday), toDateStr(today)]) {
    try {
      const { rows } = await computeMetricsForDate(container, dateStr);
      logger.info(`[RecurringOrder] métricas ${dateStr}: ${rows} filas`);
    } catch (e) {
      logger.error(
        `[RecurringOrder] métricas ${dateStr} fallaron: ${(e as Error).message}`,
      );
    }
  }
}

export const config = {
  name: 'compute-recurring-metrics',
  schedule: process.env.RECURRING_METRICS_CRON || '0 3 * * *',
};
