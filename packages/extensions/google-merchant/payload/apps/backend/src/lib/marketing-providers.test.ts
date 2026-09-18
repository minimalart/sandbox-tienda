import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMerchantItems, wrapMerchantFeed } from './google-merchant-feed.ts';
import { normalizeClarity, clarityOverview } from './clarity-report.ts';
import { publicClarity } from './marketing-privacy-public.ts';
import { validateClarity } from '../modules/app-settings/descriptors/clarity.ts';
import { validateMerchant } from '../modules/app-settings/descriptors/google-merchant.ts';
const config = {
  enabled: true,
  storefrontUrl: 'https://shop.example/demo/a/ar',
  regionId: 'reg_a',
  salesChannelId: 'sc_a',
  stockLocationId: 'sloc_a',
  brand: 'Acme',
};
const variant = () => ({
  id: 'variant_a',
  title: 'Small',
  ean: '4006381333931',
  manage_inventory: true,
  allow_backorder: false,
  calculated_price: {
    calculated_amount: 10.25,
    original_amount: 12.5,
    currency_code: 'ars',
    is_calculated_price_tax_inclusive: true,
  },
  inventory_items: [
    {
      required_quantity: 2,
      inventory: {
        location_levels: [
          { location_id: 'sloc_a', available_quantity: 1 },
          { location_id: 'sloc_b', available_quantity: 100 },
        ],
      },
    },
  ],
});
const product = () => ({
  id: 'prod_a',
  status: 'published',
  title: 'A & B',
  description: '<p>A product</p>',
  handle: 'a',
  thumbnail: 'https://example.com/a.jpg',
  sales_channels: [{ id: 'sc_a' }],
  variants: [variant()],
});
test('feed preserves regional decimal prices, XML escaping, stable variant links and scoped inventory', () => {
  const built = buildMerchantItems([product()], config, 'ars');
  assert.equal(built.items.length, 1);
  const xml = wrapMerchantFeed(built.items, config);
  assert.match(xml, /<g:title>A &amp; B - Small/);
  assert.match(xml, /<g:price>12.50 ARS/);
  assert.match(xml, /<g:sale_price>10.25 ARS/);
  assert.match(xml, /<g:availability>out_of_stock/);
  assert.match(xml, /demo\/a\/ar\/products\/a\?variant=variant_a/);
});
test('feed never includes a different sales channel, drafts or unavailable prices', () => {
  const other = product();
  other.sales_channels = [{ id: 'sc_b' }];
  const draft = product();
  draft.status = 'draft';
  const bad = product();
  bad.variants[0].calculated_price.is_calculated_price_tax_inclusive = false;
  const built = buildMerchantItems([other, draft, bad], config, 'ars');
  assert.equal(built.items.length, 0);
  assert.deepEqual(built.skipped, [{ id: 'variant_a', reason: 'tax_exclusive_price' }]);
});
test('all inventory components must cover required quantity and backorders require a date', () => {
  const p = product();
  p.variants[0].inventory_items[0].inventory.location_levels[0].available_quantity = 2;
  assert.match(buildMerchantItems([p], config, 'ars').items[0], /in_stock/);
  p.variants[0].inventory_items.push({ required_quantity: 1, inventory: { location_levels: [] } });
  assert.match(buildMerchantItems([p], config, 'ars').items[0], /out_of_stock/);
  p.variants[0].allow_backorder = true;
  assert.equal(buildMerchantItems([p], config, 'ars').skipped[0].reason, 'backorder_requires_date');
});
test('invalid content, identifiers and wholesale variants are reported instead of fabricated', () => {
  const p: any = product();
  p.variants[0].ean = '';
  assert.equal(buildMerchantItems([p], config, 'ars').skipped[0].reason, 'missing_identifiers');
  p.metadata = { identifier_exists: false };
  assert.equal(buildMerchantItems([p], config, 'ars').items.length, 1);
  p.variants[0].options = [{ value: 'Bulto' }];
  assert.equal(buildMerchantItems([p], config, 'ars').skipped[0].reason, 'wholesale_variant');
  p.variants[0].options = [];
  p.thumbnail = 'javascript:alert(1)';
  assert.equal(buildMerchantItems([p], config, 'ars').skipped[0].reason, 'missing_content');
});
test('provider configuration validates destinations and browser response excludes secrets', () => {
  assert.equal(validateMerchant(config), null);
  assert.ok(validateMerchant({ ...config, storefrontUrl: 'javascript:alert(1)' }));
  assert.ok(validateMerchant({ ...config, stockLocationId: '' }));
  assert.equal(
    validateClarity({ enabled: true, projectId: 'abc123', consentCategory: 'analytics' }),
    null
  );
  assert.ok(
    validateClarity({ enabled: true, projectId: 'abc/../bad', consentCategory: 'analytics' })
  );
  assert.deepEqual(
    publicClarity({
      enabled: true,
      projectId: 'abc123',
      EXPORT_TOKEN: 'private',
      consentCategory: 'marketing',
    }),
    { enabled: true, projectId: 'abc123', consentCategory: 'analytics' }
  );
});
test('Clarity report preserves zero values, excludes nested payloads and rejects malformed responses', () => {
  assert.deepEqual(
    normalizeClarity([
      {
        metricName: 'Traffic',
        information: [
          { totalSessionCount: 0, nested: { secret: 'x' }, pagesPerSessionPercentage: '1.25' },
        ],
      },
    ]),
    [{ name: 'Traffic', rows: [{ totalSessionCount: 0, pagesPerSessionPercentage: '1.25' }] }]
  );
  assert.throws(() => normalizeClarity({ error: 'unauthorized' }));
  assert.throws(() => normalizeClarity([{ metricName: 'Traffic' }]));
  assert.deepEqual(
    clarityOverview([
      {
        name: 'Traffic',
        rows: [{ totalSessionCount: 10, totalBotSessionCount: 2, pagesPerSessionPercentage: 0 }],
      },
    ]),
    { sessions: 8, pagesPerSession: 0, scrollDepth: null, activeTimeSeconds: null }
  );
  assert.equal(
    clarityOverview([
      { name: 'Traffic', rows: [{ totalSessionCount: 10 }, { totalSessionCount: 12 }] },
    ]).sessions,
    null
  );
});
