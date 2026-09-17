import { ContainerRegistrationKeys, QueryContext } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import type { SiteResolution } from './multistore/types';
import { resolveSettingFor } from '../modules/app-settings/service';
import { findDescriptor } from '../modules/app-settings/descriptors';
import {
  validateMerchant,
  type MerchantConfig,
} from '../modules/app-settings/descriptors/google-merchant';
import { cachedReport, reportKey } from './marketing-report-cache';
import { buildMerchantItems, wrapMerchantFeed } from './google-merchant-feed';
import { effectiveCommercial } from './catalog/cart-validation';

export async function merchantReport(container: MedusaContainer, site: SiteResolution) {
  const config = await resolveSettingFor<MerchantConfig>(
    container,
    findDescriptor('extension:google-merchant', 'CONFIG')!,
    site
  );
  if (!config?.enabled || validateMerchant(config))
    throw new Error('Merchant is disabled or incomplete');
  if (site.status === 'unknownSite' || site.status === 'allSites')
    throw new Error('Select a store');
  if (
    'site' in site &&
    (!site.site.channel_ids.includes(config.salesChannelId) ||
      (site.site.region_id && site.site.region_id !== config.regionId) ||
      (site.site.stock_location_id && site.site.stock_location_id !== config.stockLocationId))
  )
    throw new Error('Merchant scope does not match the store');
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: channels } = await query.graph({
    entity: 'sales_channel',
    fields: ['id', 'stock_locations.id'],
    filters: { id: config.salesChannelId },
  });
  if (
    !(channels[0] as any)?.stock_locations?.some(
      (location: any) => location.id === config.stockLocationId
    )
  )
    throw new Error('Stock location is not linked to the sales channel');
  const { data: regions } = await query.graph({
    entity: 'region',
    fields: ['id', 'currency_code'],
    filters: { id: config.regionId },
  });
  if (!regions[0]) throw new Error('Region not found');
  const currency = regions[0].currency_code;
  return cachedReport(
    container,
    reportKey('merchant', 'site' in site ? site.site.id : 'main', config),
    900,
    async () => {
      const items: string[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];
      let skippedCount = 0;
      for (let skip = 0; ; skip += 200) {
        const { data } = await query.graph({
          entity: 'product',
          filters: { status: 'published' },
          fields: [
            'id',
            'status',
            'title',
            'description',
            'handle',
            'thumbnail',
            'images.url',
            'metadata',
            'sales_channels.id',
            'variants.id',
            'variants.title',
            'variants.ean',
            'variants.upc',
            'variants.barcode',
            'variants.metadata',
            'variants.manage_inventory',
            'variants.allow_backorder',
            'variants.options.value',
            'variants.options.option.title',
            'variants.calculated_price.*',
            'variants.inventory_items.required_quantity',
            'variants.inventory_items.inventory.location_levels.location_id',
            'variants.inventory_items.inventory.location_levels.available_quantity',
          ],
          context: {
            variants: {
              calculated_price: QueryContext({
                region_id: config.regionId,
                currency_code: currency,
              }),
            },
          },
          pagination: { skip, take: 200, order: { id: 'ASC' } },
        });
        const scoped = data.filter((p: any) =>
          p.sales_channels?.some((c: any) => c.id === config.salesChannelId)
        );
        for (const p of scoped as any[])
          for (const v of p.variants ?? []) {
            const commercial = await effectiveCommercial(container, { ...v, product: p });
            if (commercial) v.metadata = { ...v.metadata, catalog_commercial: commercial };
          }
        const built = buildMerchantItems(scoped, config, currency);
        items.push(...built.items);
        skippedCount += built.skipped.length;
        skipped.push(...built.skipped.slice(0, Math.max(0, 100 - skipped.length)));
        if (data.length < 200) break;
      }
      return {
        xml: wrapMerchantFeed(items, config),
        count: items.length,
        skippedCount,
        skipped,
        generatedAt: new Date().toISOString(),
        currency,
      };
    }
  );
}
