import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { z } from 'zod';
import { STORE_LOCATION_MODULE } from '../../../../modules/store-location';
import type StoreLocationModuleService from '../../../../modules/store-location/service';
import { toPublicStoreLocation } from '../helpers';

const coord = z.union([z.number(), z.string()]).transform((v) => String(v));

const ResolveSchema = z.object({
  lat: coord,
  lng: coord,
});

type LinkedChannel = {
  id: string;
  name?: string;
  is_disabled?: boolean;
  metadata?: Record<string, unknown> | null;
};

/**
 * Picks the branch's storefront (B2C) sales channel: the first enabled channel
 * whose `metadata.channel_type === 'b2c'`, falling back to the first enabled one.
 */
function pickB2CChannel(channels: LinkedChannel[]): LinkedChannel | null {
  const enabled = channels.filter((c) => !c.is_disabled);
  return (
    enabled.find((c) => (c.metadata?.channel_type as string | undefined) === 'b2c') ??
    enabled[0] ??
    null
  );
}

/**
 * POST /store/store-locations/resolve — given a lat/lng, returns the branch that
 * covers it (by polygon) and its B2C sales channel. Always 200; `covered: false`
 * when the point is outside every active coverage.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  let body: z.infer<typeof ResolveSchema>;
  try {
    body = ResolveSchema.parse(req.body);
  } catch {
    return res.status(400).json({ message: 'lat and lng are required' });
  }

  try {
    const service: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);
    const match = await service.resolveByPoint({ lat: body.lat, lng: body.lng });

    if (!match) {
      return res.status(200).json({ covered: false, branch: null, sales_channel_id: null });
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
      entity: 'store_location',
      fields: [
        'id',
        'name',
        'street',
        'city',
        'province',
        'lat',
        'lng',
        'store_type',
        'phone',
        'whatsapp',
        'email',
        'website',
        'instagram',
        'facebook',
        'tiktok',
        'linkedin',
        'business_hours',
        'images',
        'sales_channels.id',
        'sales_channels.name',
        'sales_channels.is_disabled',
        'sales_channels.metadata',
      ],
      filters: { id: match.store_location_id },
    });

    const branch = data?.[0];
    if (!branch) {
      return res.status(200).json({ covered: false, branch: null, sales_channel_id: null });
    }

    const channel = pickB2CChannel((branch.sales_channels ?? []) as LinkedChannel[]);

    // Informational delivery settings for the matched branch (if active).
    const [delivery] = await service.listBranchDeliveries({
      store_location_id: match.store_location_id,
      active: true,
    });

    return res.status(200).json({
      covered: true,
      branch: toPublicStoreLocation(branch),
      sales_channel_id: channel?.id ?? null,
      coverage_id: match.coverage_id,
      match_type: match.match_type,
      delivery: delivery
        ? {
            lead_time_hours: delivery.lead_time_hours,
            timezone: delivery.timezone,
            schedules: delivery.schedules,
          }
        : null,
    });
  } catch (error) {
    console.error('[StoreLocations] Error resolving branch by point:', error);
    return res.status(200).json({ covered: false, branch: null, sales_channel_id: null });
  }
}
