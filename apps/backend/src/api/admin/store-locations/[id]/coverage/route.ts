import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { STORE_LOCATION_SITE_SCOPE } from '../../../../../modules/store-location/site-scope';
import { STORE_LOCATION_MODULE } from '../../../../../modules/store-location';
import type StoreLocationModuleService from '../../../../../modules/store-location/service';
import { PostAdminCreateCoverage } from '../../validators';

/**
 * GET /admin/store-locations/:id/coverage — list a branch's coverage polygons.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), STORE_LOCATION_SITE_SCOPE, req.params.id as string);

  try {
    const service: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);
    const coverages = await service.listBranchCoverages(
      { store_location_id: req.params.id as string },
      { order: { priority: 'DESC' } },
    );
    return res.status(200).json({ coverages });
  } catch (error) {
    console.error('[Admin StoreLocations] Error listing coverages:', error);
    return res.status(500).json({ message: 'Error listing coverages' });
  }
}

/**
 * POST /admin/store-locations/:id/coverage — create a coverage polygon.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), STORE_LOCATION_SITE_SCOPE, req.params.id as string);

  try {
    const validated = PostAdminCreateCoverage.parse(req.body);
    const service: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);

    const coverage = await service.createBranchCoverages({
      store_location_id: req.params.id as string,
      name: validated.name,
      polygon: validated.polygon as unknown as Record<string, unknown>,
      priority: validated.priority ?? 0,
      active: validated.active ?? true,
    });

    return res.status(201).json({ coverage });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error creating coverage';
    console.error('[Admin StoreLocations] Error creating coverage:', message);
    return res.status(400).json({ message });
  }
}
