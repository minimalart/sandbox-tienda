import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { STORE_LOCATION_MODULE } from '../../../../modules/store-location';
import type StoreLocationModuleService from '../../../../modules/store-location/service';
import type { PolygonPoint } from '../../../../modules/store-location/coverage/types';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { BRANCH_COVERAGE_SITE_SCOPE } from '../../../../modules/store-location/site-scope';

/**
 * GET /admin/delivery/coverages-overview — todas las coberturas activas con su
 * polígono y la sucursal a la que pertenecen. Alimenta el mapa "ver todas las
 * coberturas" del admin (coloreado por sucursal), sin tener que elegir una
 * sucursal a la vez.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const storeLocation = req.scope.resolve<StoreLocationModuleService>(
    STORE_LOCATION_MODULE,
  );

  // El descriptor ya no se declara acá: apareció la segunda ruta que lo necesitaba
  // (`store-locations/:id/coverage/:coverageId`) y, como esta misma ruta se anotó en su
  // día, se mudó a `modules/store-location/site-scope.ts`. El porqué de `empty: 'all'`
  // viaja con él, al lado del descriptor.
  const coverages = (await storeLocation.listBranchCoverages(
    {
      active: true,
      ...(await siteFilter(req.scope, await siteFromRequest(req), BRANCH_COVERAGE_SITE_SCOPE)),
    },
    { take: 1000 },
  )) as unknown as Array<{
    id: string;
    name: string;
    store_location_id: string | null;
    polygon: PolygonPoint[] | null;
  }>;

  const storeIds = Array.from(
    new Set(
      coverages
        .map((c) => c.store_location_id)
        .filter((id): id is string => !!id),
    ),
  );
  const stores = storeIds.length
    ? ((await storeLocation.listStoreLocations({ id: storeIds })) as Array<{
        id: string;
        name: string;
      }>)
    : [];
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));

  const result = coverages
    .filter((c) => Array.isArray(c.polygon) && c.polygon.length >= 3)
    .map((c) => ({
      id: c.id,
      name: c.name,
      store_location_id: c.store_location_id,
      store_name: c.store_location_id
        ? (storeNameById.get(c.store_location_id) ?? null)
        : null,
      polygon: c.polygon as PolygonPoint[],
    }));

  res.status(200).json({ coverages: result });
}
