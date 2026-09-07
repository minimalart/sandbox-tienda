import type { ProviderLoaderOptions } from '@medusajs/framework/types';
import { syncMercadoPagoApiRegionProviders } from '../lib/sync-region-providers';

/** Link installed providers at boot. Runtime activation filters the storefront
 * provider list and gates new payments; settlement remains available. */
export default async function syncMercadoPagoApiRegions({
  container,
  logger,
}: ProviderLoaderOptions): Promise<void> {
  try {
    await syncMercadoPagoApiRegionProviders({ container, enabled: true, logger });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger?.warn(`[mercadopago-api] Boot region sync skipped (${message}).`);
  }
}
