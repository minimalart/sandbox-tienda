/**
 * Andreani fulfillment ModuleProvider registration.
 *
 * Registered inside the Fulfillment module's `providers` array in
 * medusa-config.ts. The provider id is `andreani`, so its container
 * registration key is `fp_andreani_andreani`.
 */

import { ModuleProvider, Modules } from '@medusajs/framework/utils';
import AndreaniFulfillmentProviderService from './service';

export const ANDREANI_FULFILLMENT_PROVIDER_ID = 'andreani';

/**
 * Container registration key for the configured provider instance.
 * Format: `fp_{identifier}_{id}` where both are `andreani`.
 */
export const ANDREANI_FULFILLMENT_REGISTRATION_KEY = 'fp_andreani_andreani';

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [AndreaniFulfillmentProviderService],
});
