import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { isMercadoPagoEnabled } from '../modules/mercado-pago/constants';
import { syncMercadoPagoRegionProviders } from '../modules/mercado-pago/lib/sync-region-providers';
import { isMercadoPagoApiEnabled } from '../modules/mercado-pago-api/constants';
import { syncMercadoPagoApiRegionProviders } from '../modules/mercado-pago-api/lib/sync-region-providers';

/**
 * Idempotent reconcile of BOTH MercadoPago payment providers across all regions,
 * driven by their env toggles. Reliable manual counterpart to the boot-time
 * loaders — run it after flipping MERCADOPAGO_ENABLED / MERCADOPAGO_API_ENABLED,
 * or any time the region ↔ provider links drift.
 *
 * Usage:
 *   pnpm --filter @repo/backend exec medusa exec ./src/scripts/setup-mercadopago.ts
 *
 * Behaviour:
 *   MERCADOPAGO_ENABLED=true      (+ token) → links   pp_mercadopago_mercadopago (Express)
 *   MERCADOPAGO_API_ENABLED=true  (+ token) → links   pp_mercadopagoapi_mercadopagoapi (Checkout API)
 *   otherwise (each)                        → unlinks the corresponding provider
 * Manual payment (pp_system_default) and any other provider are left untouched.
 */
export default async function setupMercadoPago({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const expressEnabled = isMercadoPagoEnabled();
  const apiEnabled = isMercadoPagoApiEnabled();

  logger.info(
    `[mercadopago] Reconciling regions — Express ${
      expressEnabled ? 'ENABLED' : 'DISABLED'
    }, Checkout API ${apiEnabled ? 'ENABLED' : 'DISABLED'}.`,
  );

  await syncMercadoPagoRegionProviders({ container, enabled: expressEnabled, logger });
  await syncMercadoPagoApiRegionProviders({ container, enabled: apiEnabled, logger });

  logger.info('[mercadopago] Region reconciliation done.');
}
