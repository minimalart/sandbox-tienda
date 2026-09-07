import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { recommendationsJobsEnabled } from '../modules/recommendations/config';
import { aggregateRecommendationMetrics } from '../modules/recommendations/events/aggregate';
import { getRecommendationsSettings } from '../modules/recommendations/settings';

/**
 * Agrega eventos a métricas horarias y diarias (PRD §13.4).
 *
 * Recalcula una VENTANA RODANTE en lugar de sólo el período que acaba de cerrar. Es lo que
 * hace que se autocorrijan, sin lógica de reconciliación aparte:
 *
 *  - las cancelaciones de orden (el subscriber sella `voided_at` y el recálculo deja de
 *    contarlas),
 *  - los eventos que llegan tarde (un beacon disparado al cerrar la pestaña puede
 *    aterrizar minutos después),
 *  - cualquier corrida que haya fallado antes.
 *
 * El diario se recalcula para hoy Y ayer, por el mismo motivo y porque a las 00:15 la
 * mayoría de los eventos del día anterior recién terminaron de llegar (patrón de
 * `compute-recurring-metrics.ts`).
 */

const startOfHour = (date: Date): Date => {
  const copy = new Date(date);
  copy.setMinutes(0, 0, 0);
  return copy;
};

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export default async function recommendationsAggregateEventsJob(
  container: MedusaContainer,
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  if (!recommendationsJobsEnabled()) return;

  // Dentro del cuerpo y no en scope de módulo: el archivo del job se evalúa al
  // arrancar, antes de que el loader de `app-settings` llene el snapshot, así que un
  // `const` acá arriba se quedaría con el valor del entorno para siempre.
  const lookbackHours = getRecommendationsSettings().aggregateLookbackHours;

  try {
    const now = new Date();

    // Horario: ventana rodante. El `to` es exclusivo y se pone en la próxima hora para
    // incluir la hora en curso.
    const hourlyTo = new Date(startOfHour(now).getTime() + 60 * 60 * 1000);
    const hourlyFrom = new Date(hourlyTo.getTime() - lookbackHours * 60 * 60 * 1000);

    const hourly = await aggregateRecommendationMetrics(container, {
      bucket: 'hourly',
      from: hourlyFrom,
      to: hourlyTo,
    });

    // Diario: ayer y hoy.
    const dailyTo = new Date(startOfDay(now).getTime() + 24 * 60 * 60 * 1000);
    const dailyFrom = new Date(startOfDay(now).getTime() - 24 * 60 * 60 * 1000);

    const daily = await aggregateRecommendationMetrics(container, {
      bucket: 'daily',
      from: dailyFrom,
      to: dailyTo,
    });

    if (hourly.rows_inserted || daily.rows_inserted) {
      logger.info(
        `[recommendations-aggregate] horarias: ${hourly.rows_inserted} · diarias: ${daily.rows_inserted}`,
      );
    }
  } catch (error) {
    // Nunca se propaga: un fallo de agregación no puede tumbar el scheduler, y la
    // ventana rodante lo recupera en la próxima corrida.
    logger.error(
      `[recommendations-aggregate] fallo: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export const config = {
  name: 'recommendations-aggregate-events',
  schedule: process.env.RECOMMENDATIONS_AGGREGATE_CRON || '15 * * * *',
};
