import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { STORE_LOCATION_MODULE } from '../../../modules/store-location';
import type StoreLocationModuleService from '../../../modules/store-location/service';
import { PostAdminCreateStoreLocation } from './validators';
import { siteFromRequest, siteFilter, siteDefaults } from '../../../lib/multistore';
import { STORE_LOCATION_SITE_SCOPE } from '../../../modules/store-location/site-scope';

/**
 * GET /admin/store-locations — paginated list with optional `q` search.
 *
 * Query params: limit (default 20), offset (default 0), q (matches
 * name/city/province, case-insensitive via $ilike).
 * Returns { store_locations, count, limit, offset }.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const filters: Record<string, unknown> = {};
    if (q) {
      // MedusaService filters pass through to MikroORM, which supports $or/$ilike.
      filters.$or = [
        { name: { $ilike: `%${q}%` } },
        { city: { $ilike: `%${q}%` } },
        { province: { $ilike: `%${q}%` } },
      ];
    }

    // Dentro de listAndCount: filtrar el resultado desalinearía el count.
    Object.assign(
      filters,
      await siteFilter(req.scope, await siteFromRequest(req), STORE_LOCATION_SITE_SCOPE),
    );

    const [store_locations, count] = await service.listAndCountStoreLocations(filters, {
      skip: offset,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return res.status(200).json({ store_locations, count, limit, offset });
  } catch (error) {
    console.error('[Admin StoreLocations] Error listing store locations:', error);
    return res.status(500).json({ message: 'Error fetching store locations' });
  }
}

/**
 * POST /admin/store-locations — create a store location.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const validated = PostAdminCreateStoreLocation.parse(req.body);
    const service: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);

    // Sin canales explícitos, la sucursal nace en la tienda activa. Un array vacío
    // o null explícito sigue significando "atiende a todas".
    const channels =
      validated.sales_channel_ids === undefined
        ? ((siteDefaults(await siteFromRequest(req), STORE_LOCATION_SITE_SCOPE) as {
            sales_channel_ids?: string[];
          }).sales_channel_ids ?? null)
        : (validated.sales_channel_ids ?? null);

    // `images` / `sales_channel_ids` are string[] but model.json() infers
    // Record<string, unknown>.
    const store_location = await service.createStoreLocations({
      ...validated,
      images: (validated.images ?? null) as unknown as Record<string, unknown> | null,
      sales_channel_ids: channels as unknown as Record<
        string,
        unknown
      > | null,
    });

    return res.status(201).json({ store_location });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error creating store location';
    console.error('[Admin StoreLocations] Error creating store location:', message);
    return res.status(400).json({ message });
  }
}
