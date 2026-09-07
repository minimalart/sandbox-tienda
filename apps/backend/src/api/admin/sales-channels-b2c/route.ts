import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { Modules } from '@medusajs/framework/utils';

/**
 * GET /admin/sales-channels-b2c
 *
 * Returns the B2C sales channels available for sales links. Channels carry a
 * `metadata.channel_type` of 'b2c' | 'b2b'; we return the enabled ones whose
 * type is 'b2c'.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: any = req.scope.resolve(Modules.SALES_CHANNEL);
    const all = await service.listSalesChannels({});

    const channels = (all as any[]).filter((c) => {
      const type = String(c?.metadata?.channel_type ?? '').toLowerCase();
      return !c.is_disabled && type === 'b2c';
    });

    return res.status(200).json({
      sales_channels: channels.map((c) => ({ id: c.id, name: c.name })),
    });
  } catch (error) {
    console.error('[Admin SalesChannelsB2C] Error listing channels:', error);
    return res.status(500).json({ sales_channels: [] });
  }
}
