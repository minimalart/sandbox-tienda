import { isSubscriptionFeatureEnabled } from '../modules/recurring-order/settings';
import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { refreshSubscriptionStockAlerts } from '../modules/recurring-order/forecast';

export default async function forecastRecurringStockJob(container: MedusaContainer): Promise<void> {
  if (!isSubscriptionFeatureEnabled('SUBSCRIPTIONS_STOCK_FORECAST_ENABLED')) return;
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  try {
    const rows = await refreshSubscriptionStockAlerts(container);
    const risks = rows.filter((row) => row.deficit_14d > 0 || row.deficit_30d > 0);
    logger.info(
      `[Subscriptions V2] forecast: ${rows.length} variantes, ${risks.length} en riesgo.`
    );
  } catch (error) {
    logger.error(`[Subscriptions V2] forecast falló: ${(error as Error).message}`);
  }
}

export const config = {
  name: 'forecast-recurring-stock',
  schedule: process.env.SUBSCRIPTIONS_STOCK_FORECAST_CRON || '15 4 * * *',
};
