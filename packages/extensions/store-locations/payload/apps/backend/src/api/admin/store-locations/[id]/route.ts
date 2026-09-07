import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { STORE_LOCATION_MODULE } from '../../../../modules/store-location';
import type StoreLocationModuleService from '../../../../modules/store-location/service';
import { PostAdminUpdateStoreLocation } from '../validators';
import { siteFromRequest, assertRowInSite } from '../../../../lib/multistore';
import { STORE_LOCATION_SITE_SCOPE } from '../../../../modules/store-location/site-scope';

/**
 * GET /admin/store-locations/:id
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);
    const store_location = await service.retrieveStoreLocation(req.params.id as string);
    assertRowInSite(
      store_location as Record<string, unknown>,
      await siteFromRequest(req),
      STORE_LOCATION_SITE_SCOPE,
    );
    return res.status(200).json({ store_location });
  } catch (error) {
    console.error('[Admin StoreLocations] Error retrieving store location:', error);
    return res.status(404).json({ message: 'Store location not found' });
  }
}

/**
 * POST /admin/store-locations/:id — partial update.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const validated = PostAdminUpdateStoreLocation.parse(req.body);
    const service: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);

    // Partial update: only touch the json keys when they were sent.
    // (both are string[] but model.json() infers Record<string, unknown>.)
    const { images, sales_channel_ids, ...rest } = validated;
    assertRowInSite(
      (await service.retrieveStoreLocation(req.params.id as string)) as Record<string, unknown>,
      await siteFromRequest(req),
      STORE_LOCATION_SITE_SCOPE,
    );

    const store_location = await service.updateStoreLocations({
      id: req.params.id as string,
      ...rest,
      ...(images !== undefined
        ? { images: images as unknown as Record<string, unknown> | null }
        : {}),
      ...(sales_channel_ids !== undefined
        ? {
            sales_channel_ids: (sales_channel_ids ?? null) as unknown as Record<
              string,
              unknown
            > | null,
          }
        : {}),
    });

    return res.status(200).json({ store_location });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error updating store location';
    console.error('[Admin StoreLocations] Error updating store location:', message);
    return res.status(400).json({ message });
  }
}

/**
 * DELETE /admin/store-locations/:id — soft delete.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);
    const id = req.params.id as string;

    assertRowInSite(
      (await service.retrieveStoreLocation(id)) as Record<string, unknown>,
      await siteFromRequest(req),
      STORE_LOCATION_SITE_SCOPE,
    );

    await service.softDeleteStoreLocations(id);

    return res.status(200).json({ id, object: 'store_location', deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error deleting store location';
    console.error('[Admin StoreLocations] Error deleting store location:', message);
    return res.status(400).json({ message });
  }
}
