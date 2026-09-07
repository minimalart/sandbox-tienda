import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type { ICustomerModuleService } from '@medusajs/framework/types';
import { STORE_LOCATION_MODULE } from '../../../../modules/store-location';
import type StoreLocationModuleService from '../../../../modules/store-location/service';
import { toPublicStoreLocation } from '../helpers';

const PREFERRED_KEY = 'preferred_store_location_id';

/**
 * GET /store/store-locations/preferred — the authenticated customer's
 * preferred store location (or null). The selection lives in the customer's
 * metadata under `preferred_store_location_id` — no customer model migration.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context.actor_id;
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER);
  const locationService: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);

  const customer = await customerService.retrieveCustomer(customerId);
  const preferredId = customer.metadata?.[PREFERRED_KEY];

  if (!preferredId || typeof preferredId !== 'string') {
    return res.status(200).json({ store_location: null });
  }

  const locations = await locationService.listStoreLocations({
    id: preferredId,
    is_visible: true,
  });

  const preferred = locations[0];
  if (!preferred) {
    // The stored preference points to a deleted/hidden location.
    return res.status(200).json({ store_location: null });
  }

  return res.status(200).json({ store_location: toPublicStoreLocation(preferred) });
}

/**
 * POST /store/store-locations/preferred — set the authenticated customer's
 * preferred store location. Body: { store_location_id: string }.
 * The location must exist and be visible.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context.actor_id;
  const body = (req.body ?? {}) as { store_location_id?: unknown };
  const storeLocationId = body.store_location_id;

  if (!storeLocationId || typeof storeLocationId !== 'string') {
    return res.status(400).json({ message: 'store_location_id is required' });
  }

  const locationService: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);
  const locations = await locationService.listStoreLocations({
    id: storeLocationId,
    is_visible: true,
  });

  const selected = locations[0];
  if (!selected) {
    return res.status(404).json({ message: 'Store location not found' });
  }

  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER);
  const customer = await customerService.retrieveCustomer(customerId);

  await customerService.updateCustomers(customerId, {
    metadata: {
      ...(customer.metadata ?? {}),
      [PREFERRED_KEY]: storeLocationId,
    },
  });

  return res.status(200).json({ store_location: toPublicStoreLocation(selected) });
}
