import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { STORE_LOCATION_MODULE } from '../../../modules/store-location';
import type StoreLocationModuleService from '../../../modules/store-location/service';
import { isLocationInSalesChannel, readStrictFlag, toPublicStoreLocation } from './helpers';

/**
 * GET /store/store-locations — public list of visible store locations.
 *
 * Query params: `sales_channel_id` scopes the list to the branches visible in
 * that channel (globals included), `strict=1` additionally hides the globals so
 * a demo lists only its own branches.
 *
 * Always returns 200 — empty array on error.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);
    const salesChannelId =
      typeof req.query.sales_channel_id === 'string' ? req.query.sales_channel_id : undefined;
    const strict = readStrictFlag(req.query as Record<string, unknown>);

    const locations = await service.listStoreLocations(
      { is_visible: true },
      { order: { name: 'ASC' } },
    );

    // sales_channel_ids is jsonb, so the scope is filtered in JS (same as blog).
    const scoped = locations.filter((location) =>
      isLocationInSalesChannel(location as unknown as Record<string, any>, salesChannelId, strict),
    );

    return res.status(200).json({ store_locations: scoped.map(toPublicStoreLocation) });
  } catch (error) {
    console.error('[StoreLocations] Error fetching store locations:', error);
    return res.status(200).json({ store_locations: [] });
  }
}
