import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { STORE_LOCATION_SITE_SCOPE } from '../../../../../modules/store-location/site-scope';
import { STORE_LOCATION_MODULE } from '../../../../../modules/store-location';
import type StoreLocationModuleService from '../../../../../modules/store-location/service';
import { PostAdminBranchDelivery } from '../../validators';

/**
 * GET /admin/store-locations/:id/delivery — the branch's delivery settings (or null).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), STORE_LOCATION_SITE_SCOPE, req.params.id as string);

  try {
    const service: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);
    const [delivery] = await service.listBranchDeliveries({
      store_location_id: req.params.id as string,
    });
    return res.status(200).json({ delivery: delivery ?? null });
  } catch (error) {
    console.error('[Admin StoreLocations] Error reading delivery settings:', error);
    return res.status(500).json({ message: 'Error reading delivery settings' });
  }
}

/**
 * POST /admin/store-locations/:id/delivery — upsert the branch's delivery
 * settings (one row per branch).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), STORE_LOCATION_SITE_SCOPE, req.params.id as string);

  try {
    const validated = PostAdminBranchDelivery.parse(req.body);
    const service: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);
    const storeLocationId = req.params.id as string;

    const { schedules, ...rest } = validated;
    const data = {
      ...rest,
      ...(schedules !== undefined
        ? { schedules: schedules as unknown as Record<string, unknown> | null }
        : {}),
    };

    const [existing] = await service.listBranchDeliveries({ store_location_id: storeLocationId });

    const delivery = existing
      ? await service.updateBranchDeliveries({ id: existing.id, ...data })
      : await service.createBranchDeliveries({ store_location_id: storeLocationId, ...data });

    return res.status(200).json({ delivery });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error saving delivery settings';
    console.error('[Admin StoreLocations] Error saving delivery settings:', message);
    return res.status(400).json({ message });
  }
}
