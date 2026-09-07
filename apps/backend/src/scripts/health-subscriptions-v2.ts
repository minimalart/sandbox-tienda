import { readMercadoPagoSetting } from '../modules/app-settings/mercadopago-runtime';
import { isSubscriptionFeatureEnabled } from '../modules/recurring-order/settings';
import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from '../modules/recurring-order';
import type RecurringOrderModuleService from '../modules/recurring-order/service';
import { parseMpAccounts } from '../modules/mercado-pago/utils/accounts';

/** Health check sin mutaciones para despliegues y upgrades de la extensión. */
export default async function healthSubscriptionsV2({ container }: ExecArgs): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const checks: Record<string, boolean> = {};
  try {
    await Promise.all([
      service.listSubscriptionPlans({}, { take: 1 }),
      service.listRenewalCycles({}, { take: 1 }),
      service.listSubscriptionAlerts({}, { take: 1 }),
      service.listSubscriptionNotifications({}, { take: 1 }),
    ]);
    checks.schema = true;
  } catch {
    checks.schema = false;
  }
  checks.backend_url_https =
    !process.env.SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED ||
    !isSubscriptionFeatureEnabled('SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED') ||
    /^https:\/\//.test(process.env.BACKEND_URL ?? process.env.MEDUSA_BACKEND_URL ?? '');
  const configuredAccounts = [
    ...parseMpAccounts(readMercadoPagoSetting('MERCADOPAGO_ACCOUNTS')).values(),
  ];
  checks.provider_credentials_configured =
    !isSubscriptionFeatureEnabled('SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED') ||
    Boolean(readMercadoPagoSetting('MERCADOPAGO_ACCESS_TOKEN') || configuredAccounts.length);
  checks.webhook_signature_configured =
    !isSubscriptionFeatureEnabled('SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED') ||
    Boolean(
      readMercadoPagoSetting('MERCADOPAGO_WEBHOOK_SECRET') ||
      (configuredAccounts.length && configuredAccounts.every((account) => account.webhookSecret))
    );
  checks.storefront_has_backend = Boolean(
    process.env.NEXT_PUBLIC_BASE_URL || process.env.BACKEND_URL
  );
  logger.info(`[Subscriptions V2 health] ${JSON.stringify(checks)}`);
  if (Object.values(checks).some((value) => !value)) {
    throw new Error(
      'Subscriptions V2 health check falló. Revisá migraciones, BACKEND_URL HTTPS y firma de webhooks.'
    );
  }
}
