import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchVtexCatalog, normalizeVtex } from './vtex-catalog';
import { connectionConfigSchema } from '../config';
import { isPublicAddress, publicJson, SourceHttpError } from '../http';
import { canonicalQuantity } from '../../../lib/catalog/commercial';

const config = connectionConfigSchema.parse({
  provider: 'vtex',
  sourceUrl: 'https://catalog.example.com',
  currencyCode: 'ARS',
});
const raw = (id = 'p1') => ({
  productId: id,
  productName: 'Envase',
  categories: ['/Bebidas/'],
  items: [
    {
      itemId: 'sku1',
      name: 'Unidad',
      measurementUnit: 'l',
      unitMultiplier: 0.75,
      UxB: ['12'],
      sellers: [
        {
          sellerId: 'secondary',
          commertialOffer: { Price: 10, ListPrice: 20, AvailableQuantity: 0 },
        },
        {
          sellerId: 'default',
          sellerDefault: true,
          commertialOffer: { Price: 100.4, ListPrice: 120.4 },
        },
      ],
    },
    {
      itemId: 'box',
      name: 'Caja',
      sellers: [
        {
          sellerId: 'default',
          commertialOffer: { Price: 1000, ListPrice: 1200, AvailableQuantity: 0 },
        },
      ],
    },
  ],
});

test('default seller, independent measurement, list rounding, out-of-stock SKU and explicit grouping', () => {
  const p = normalizeVtex(raw(), {
    ...config,
    fieldMapping: { unitsPerPackage: 'UxB' },
    presentation: { mode: 'grouping', priceBasis: 'unit' },
    purchasePolicy: { enabled: true, allowedModes: ['unit', 'package'] },
  })!;
  assert.equal(p.variants!.length, 2);
  const v = p.variants![0]!;
  assert.equal(v.price, 100);
  assert.equal(v.listPrice, 120);
  assert.equal(v.commercial!.sellerRef, 'default');
  assert.equal(v.commercial!.availability!.status, 'unknown');
  assert.equal(v.commercial!.unitMultiplier, 0.75);
  assert.equal(v.commercial!.presentation!.unitsPerPackage, 12);
  assert.equal(canonicalQuantity(2, 'package', v.commercial), 24);
  assert.equal(p.variants![1]!.commercial!.availability!.status, 'unavailable');
  assert.equal(p.variants![1]!.commercial!.presentation!.mode, 'informational');
});
test('explicit seller never substitutes another offer; missing prices never become free', () => {
  assert.equal(normalizeVtex(raw(), { ...config, sellerRef: 'missing' }), null);
  const r = raw();
  r.items[0]!.sellers[1]!.commertialOffer.Price = NaN;
  const p = normalizeVtex(r, { ...config, sellerRef: 'default' })!;
  assert.equal(p.variants!.length, 1);
  assert.equal(p.variants![0]!.externalVariantId, 'box');
});
test('auto uses intelligent search, pages and detects repeated page as partial', async () => {
  let report: any;
  const calls: string[] = [];
  const rows = Array.from({ length: 50 }, (_, i) => raw(String(i)));
  const products = await fetchVtexCatalog(
    { sourceUrl: config.sourceUrl, sourceConfig: config, report: (r) => (report = r) },
    async (url) => {
      calls.push(url);
      return { status: 200, body: { products: rows, recordsFiltered: 100 } };
    }
  );
  assert.equal(products.length, 50);
  assert.equal(report.complete, false);
  assert.equal(report.reason, 'repeated_page');
  assert.equal(calls.length, 3);
  assert.ok(calls[0]!.includes('count=1'));
});
test('auto falls back only on unsupported; explicit legacy reports strategy and end', async () => {
  let report: any;
  const products = await fetchVtexCatalog(
    { sourceUrl: config.sourceUrl, sourceConfig: config, report: (r) => (report = r) },
    async (url) =>
      url.includes('intelligent-search')
        ? { status: 404, body: null }
        : { status: 200, body: [raw()] }
  );
  assert.equal(products.length, 1);
  assert.equal(report.strategy, 'legacy');
  assert.equal(report.complete, true);
  for (const status of [401, 403, 429, 500]) {
    let calls = 0;
    await assert.rejects(
      fetchVtexCatalog({ sourceUrl: config.sourceUrl, sourceConfig: config }, async () => {
        calls++;
        return { status, body: null };
      }),
      SourceHttpError
    );
    assert.equal(calls, 1);
  }
});
test('target count and later source failure remain partial', async () => {
  let report: any;
  const products = await fetchVtexCatalog(
    {
      sourceUrl: config.sourceUrl,
      sourceConfig: { ...config, searchStrategy: 'legacy' },
      targetCount: 1,
      report: (r) => (report = r),
    },
    async () => ({ status: 200, body: [raw(), raw('p2')] })
  );
  assert.equal(products.length, 1);
  assert.equal(report.reason, 'target_limit');
  assert.equal(report.complete, false);
  let page = 0;
  await fetchVtexCatalog(
    {
      sourceUrl: config.sourceUrl,
      sourceConfig: { ...config, searchStrategy: 'legacy' },
      report: (r) => (report = r),
    },
    async () => {
      if (page++) throw new Error('timeout');
      return { status: 200, body: Array.from({ length: 50 }, (_, i) => raw(String(i))) };
    }
  );
  assert.equal(report.reason, 'source_error');
  assert.equal(report.complete, false);
});
test('bounded retry honors Retry-After and access failure stops immediately', async () => {
  let n = 0;
  const delays: number[] = [];
  const r = await publicJson(
    'https://catalog.example.com',
    async () =>
      ++n === 1 ? { status: 429, body: null, retryAfter: '2' } : { status: 200, body: [] },
    async (delay) => {
      delays.push(delay);
    }
  );
  assert.equal(r.status, 200);
  assert.deepEqual(delays, [2000]);
  n = 0;
  await assert.rejects(
    publicJson('https://catalog.example.com', async () => {
      n++;
      return { status: 403, body: null };
    }),
    SourceHttpError
  );
  assert.equal(n, 1);
});
test('SSRF excludes private, mapped, link-local and reserved addresses', () => {
  for (const ip of [
    '127.0.0.1',
    '10.1.0.1',
    '172.16.1.1',
    '169.254.169.254',
    '192.168.1.2',
    '100.64.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'fe80::1',
    'fc00::1',
    '2002:7f00:1::',
  ])
    assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('explicit sales channel uses the public V1 contract instead of a segment cookie', async () => {
  const urls: string[] = [];
  let report: any;
  await fetchVtexCatalog(
    {
      sourceUrl: config.sourceUrl,
      sourceConfig: { ...config, sourceChannel: '2' },
      report: (r) => {
        report = r;
      },
    },
    async (url) => {
      urls.push(url);
      return { status: 200, body: { products: [raw()] } };
    }
  );
  assert.ok(
    urls.every(
      (url) =>
        new URL(url).pathname === '/api/intelligent-search/v1/product-search/' &&
        new URL(url).searchParams.get('sc') === '2'
    )
  );
  assert.equal(report.strategy, 'intelligent-search-v1');
});

test('cancellation before a page performs no source request and reports partial', async () => {
  let report: any;
  const products = await fetchVtexCatalog(
    {
      sourceUrl: config.sourceUrl,
      sourceConfig: { ...config, searchStrategy: 'legacy' },
      shouldCancel: async () => true,
      report: (r) => {
        report = r;
      },
    },
    async () => {
      throw new Error('must not fetch');
    }
  );
  assert.equal(products.length, 0);
  assert.equal(report.reason, 'cancelled');
  assert.equal(report.complete, false);
});
