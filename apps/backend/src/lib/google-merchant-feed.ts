import type { MerchantConfig } from '../modules/app-settings/descriptors/google-merchant';

const xml = (value: unknown) =>
  String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!
    );
const tag = (key: string, value: unknown) => `<g:${key}>${xml(value)}</g:${key}>`;
const text = (value: unknown) =>
  String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const httpUrl = (value: unknown) => {
  try {
    return ['http:', 'https:'].includes(new URL(String(value)).protocol);
  } catch {
    return false;
  }
};
function validGtin(value: string) {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  const digits = value.slice(0, -1).split('').reverse();
  const sum = digits.reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1),
    0
  );
  return (10 - (sum % 10)) % 10 === Number(value.at(-1));
}
export type FeedResult = { items: string[]; skipped: Array<{ id: string; reason: string }> };

/** Pure builder adapted from AEC, without its tenant, CLP rounding or global stock fallback. */
export function buildMerchantItems(
  products: any[],
  config: MerchantConfig,
  currency: string
): FeedResult {
  const result: FeedResult = { items: [], skipped: [] };
  for (const p of products) {
    if (
      p.status !== 'published' ||
      !p.sales_channels?.some((c: any) => c.id === config.salesChannelId)
    )
      continue;
    for (const v of p.variants ?? []) {
      const skip = (reason: string) => result.skipped.push({ id: v.id, reason });
      // Match the existing B2C selector: wholesale Bulto options are not selectable.
      if (v.options?.some((o: any) => String(o.value).toLowerCase().includes('bulto'))) {
        skip('wholesale_variant');
        continue;
      }
      const amount = Number(v.calculated_price?.calculated_amount);
      const original = Number(v.calculated_price?.original_amount ?? amount);
      const image = v.metadata?.image_url || p.thumbnail || p.images?.[0]?.url;
      if (!p.handle || !text(p.title) || !text(p.description) || !httpUrl(image)) {
        skip('missing_content');
        continue;
      }
      if (
        !v.calculated_price ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        v.calculated_price.currency_code?.toLowerCase() !== currency.toLowerCase()
      ) {
        skip('missing_price');
        continue;
      }
      if (v.calculated_price.is_calculated_price_tax_inclusive !== true) {
        skip('tax_exclusive_price');
        continue;
      }
      const commercial = v.metadata?.catalog_commercial;
      if (commercial?.purchasePolicy?.enabled === false) {
        skip('not_purchasable');
        continue;
      }
      const inventory = v.inventory_items ?? [];
      const inStock =
        commercial?.inventoryMode === 'availability-only'
          ? commercial.availability?.status === 'available'
          : v.manage_inventory === false ||
            (inventory.length > 0 &&
              inventory.every((item: any) => {
                const quantity = (item.inventory?.location_levels ?? [])
                  .filter((l: any) => l.location_id === config.stockLocationId)
                  .reduce((sum: number, l: any) => sum + Number(l.available_quantity ?? 0), 0);
                return quantity >= Number(item.required_quantity ?? 1);
              }));
      const date = String(v.metadata?.availability_date ?? '');
      const backorder =
        !inStock &&
        v.allow_backorder &&
        Number.isFinite(Date.parse(date)) &&
        Date.parse(date) > Date.now();
      if (!inStock && v.allow_backorder && !backorder) {
        skip('backorder_requires_date');
        continue;
      }
      const url = `${config.storefrontUrl.replace(/\/$/, '')}/products/${encodeURIComponent(p.handle)}?variant=${encodeURIComponent(v.id)}`;
      const price = (n: number) => `${n.toFixed(2)} ${currency.toUpperCase()}`;
      const brand = text(v.metadata?.brand || p.metadata?.brand || config.brand);
      const gtin = String(v.ean || v.upc || v.barcode || '').trim();
      const hasGtin = validGtin(gtin);
      const mpn = text(v.metadata?.mpn || p.metadata?.mpn);
      if (!hasGtin && !(brand && mpn) && p.metadata?.identifier_exists !== false) {
        skip('missing_identifiers');
        continue;
      }
      const title =
        `${text(p.title)}${v.title && v.title !== 'Default variant' ? ` - ${text(v.title)}` : ''}`.slice(
          0,
          150
        );
      result.items.push(
        '<item>' +
          [
            tag('id', v.id),
            tag('item_group_id', p.id),
            tag('title', title),
            tag('description', text(p.description).slice(0, 5000)),
            tag('link', url),
            tag('image_link', image),
            tag('condition', 'new'),
            tag(
              'availability',
              commercial?.availability?.status === 'unavailable'
                ? 'out_of_stock'
                : inStock
                  ? 'in_stock'
                  : backorder
                    ? 'backorder'
                    : 'out_of_stock'
            ),
            backorder ? tag('availability_date', new Date(date).toISOString()) : '',
            tag('price', price(Number.isFinite(original) && original > amount ? original : amount)),
            Number.isFinite(original) && original > amount ? tag('sale_price', price(amount)) : '',
            brand ? tag('brand', brand.slice(0, 70)) : '',
            hasGtin ? tag('gtin', gtin) : '',
            mpn ? tag('mpn', mpn) : '',
            !hasGtin && !mpn && p.metadata?.identifier_exists === false
              ? tag('identifier_exists', 'no')
              : '',
            p.metadata?.google_product_category
              ? tag('google_product_category', p.metadata.google_product_category)
              : '',
            ...(v.options ?? [])
              .filter((o: any) =>
                ['color', 'size', 'material', 'pattern'].includes(
                  String(o.option?.title).toLowerCase()
                )
              )
              .map((o: any) => tag(String(o.option.title).toLowerCase(), o.value)),
          ].join('') +
          '</item>'
      );
    }
  }
  return result;
}
export function wrapMerchantFeed(items: string[], config: MerchantConfig) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Product catalog</title><link>${xml(config.storefrontUrl)}</link><description>Store product catalog</description>${items.join('')}</channel></rss>`;
}
