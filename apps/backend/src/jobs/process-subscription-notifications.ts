import type {
  INotificationModuleService,
  Logger,
  MedusaContainer,
} from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from '../modules/recurring-order';
import type RecurringOrderModuleService from '../modules/recurring-order/service';

/** Outbox con backoff e idempotencia por dedupe_key. */
export default async function processSubscriptionNotifications(
  container: MedusaContainer,
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const notifications = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
  const now = new Date();
  const rows = await service.listSubscriptionNotifications(
    {
      status: ['pending', 'retrying'],
      next_attempt_at: { $lte: now },
    },
    { take: 100, order: { next_attempt_at: 'ASC' } },
  );
  for (const row of rows) {
    try {
      await notifications.createNotifications({
        to: row.recipient,
        channel: row.channel,
        template: row.template,
        data: (row.data ?? {}) as Record<string, unknown>,
      });
      await service.updateSubscriptionNotifications([{
        id: row.id,
        status: 'sent',
        sent_at: new Date(),
        last_error: null,
      }]);
    } catch (error) {
      const attempts = Number(row.attempt_count ?? 0) + 1;
      const terminal = attempts >= 5;
      await service.updateSubscriptionNotifications([{
        id: row.id,
        status: terminal ? 'failed' : 'retrying',
        attempt_count: attempts,
        next_attempt_at: terminal
          ? null
          : new Date(Date.now() + Math.min(24, 2 ** attempts) * 60 * 60 * 1000),
        last_error: (error as Error).message.slice(0, 1000),
      }]);
      logger.warn(
        `[Subscriptions V2] outbox ${row.id} intento ${attempts} falló: ${(error as Error).message}`,
      );
    }
  }
}

export const config = {
  name: 'process-subscription-notifications',
  schedule: process.env.SUBSCRIPTIONS_NOTIFICATIONS_CRON || '*/5 * * * *',
};
