import type { ProviderLoaderOptions } from '@medusajs/framework/types';
import { syncMercadoPagoRegionProviders } from '../lib/sync-region-providers';

/** Link installed providers at boot. Runtime activation filters the storefront
 * provider list and gates new payments; settlement remains available. */
export default async function syncMercadoPagoRegions({
  container,
  logger,
}: ProviderLoaderOptions): Promise<void> {
  try {
    await syncMercadoPagoRegionProviders({ container, enabled: true, logger });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger?.warn(
      `[mercadopago] Boot region sync skipped (${message}). ` +
        'Run `medusa exec ./src/scripts/setup-mercadopago.ts` to link MercadoPago manually.'
    );
  }
}
