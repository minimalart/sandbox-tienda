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

test('display uses actual attributes or a neutral option, never the external ID', () => {
  const source: any = raw('168006');
  source.items = [{ ...source.items[0], itemId: '168006', name: source.productName }];
  assert.equal(normalizeVtex(source, config)!.variants![0]!.value, 'Único');
  source.items[0].variations = ['Contenido'];
  source.items[0].Contenido = ['500 g'];
  assert.equal(normalizeVtex(source, config)!.variants![0]!.value, '500 g');
  source.items[0].Pack = ['Caja de 12'];
  assert.equal(
    normalizeVtex(source, { ...config, fieldMapping: { label: 'Pack' } })!.variants![0]!.value,
    'Caja de 12'
  );
  source.items.push({ ...source.items[0], itemId: 'another' });
  const variants = normalizeVtex(source, config)!.variants!;
  assert.equal(variants.length, 2);
  assert.deepEqual(
    variants.map((v) => v.value),
    ['500 g', '500 g']
  );
});

test('5986 source IDs are covered by recursive facets, deduplicated and offer-validated', async () => {
  let report: any;
  const calls: URL[] = [];
  const catalog = Array.from({ length: 5986 }, (_, i) => raw(String(i)));
  catalog[10]!.items = [];
  const transport = async (value: string) => {
    const url = new URL(value);
    calls.push(url);
    const path = url.pathname;
    let rows = path.includes('category-1/a')
      ? catalog.slice(0, 3600)
      : path.includes('category-1/b')
        ? catalog.slice(3500)
        : catalog;
    if (path.includes('brand/left')) rows = rows.slice(0, 1800);
    if (path.includes('brand/right')) rows = rows.slice(1800);
    if (path.includes('/facets/'))
      return {
        status: 200,
        body: {
          facets: [
            {
              type: 'TEXT',
              values: path.includes('category-1/a')
                ? [
                    { key: 'brand', value: 'left' },
                    { key: 'brand', value: 'right' },
                  ]
                : [
                    { key: 'category-1', value: 'a' },
                    { key: 'category-1', value: 'b' },
                  ],
            },
          ],
        },
      };
    const page = Number(url.searchParams.get('page'));
    assert.ok(page <= 50, 'never repeat the impossible page 51');
    const count = Number(url.searchParams.get('count'));
    return {
      status: 200,
      body: {
        products: rows.slice((page - 1) * 50, (page - 1) * 50 + count),
        recordsFiltered: rows.length,
      },
    };
  };
  const products = await fetchVtexCatalog(
    {
      sourceUrl: config.sourceUrl,
      sourceConfig: { ...config, sourceChannel: '2' },
      report: (r) => {
        report = r;
      },
    },
    transport
  );
  assert.equal(products.length, 5985);
  assert.equal(report.observed, 5986);
  assert.equal(report.excluded, 1);
  assert.equal(report.complete, true);
  assert.equal(report.estimatedTotal, 5986);
  assert.equal(report.pendingCount, 0);
  assert.deepEqual(report.pendingCoverage, []);
  assert.equal(new Set(products.map((p) => p.productId)).size, 5985);
  assert.ok(calls.some((u) => u.pathname.includes('/brand/left')));
  assert.ok(calls.every((u) => u.searchParams.get('sc') === '2'));
});

test('unpartitionable or sampled facets do not claim complete coverage', async () => {
  let report: any;
  await fetchVtexCatalog(
    {
      sourceUrl: config.sourceUrl,
      sourceConfig: { ...config, searchStrategy: 'intelligent-search' },
      report: (r) => {
        report = r;
      },
    },
    async (value) => {
      const url = new URL(value);
      if (url.pathname.includes('/facets/'))
        return { status: 200, body: { facets: [], sampling: true } };
      const page = Number(url.searchParams.get('page'));
      return {
        status: 200,
        body: {
          products: Array.from({ length: 50 }, (_, i) => raw(String((page - 1) * 50 + i))),
          recordsFiltered: 3000,
        },
      };
    }
  );
  assert.equal(report.complete, false);
  assert.equal(report.pendingCount, 500);
  assert.equal(report.pendingCoverage[0].page, 50);
  assert.equal(report.pendingCoverage[0].reason, 'provider_limit');
});

test('later HTTP error records exact page and query with remaining coverage', async () => {
  let report: any;
  await fetchVtexCatalog(
    {
      sourceUrl: config.sourceUrl,
      sourceConfig: { ...config, searchStrategy: 'intelligent-search' },
      report: (r) => {
        report = r;
      },
    },
    async (value) => {
      const page = Number(new URL(value).searchParams.get('page'));
      return page === 1
        ? {
            status: 200,
            body: {
              products: Array.from({ length: 50 }, (_, i) => raw(String(i))),
              recordsFiltered: 100,
            },
          }
        : { status: 400, body: { message: 'bad page' } };
    }
  );
  assert.deepEqual(report.issues, [
    { query: 'catalog', page: 2, stage: 'search', reason: 'source_error', status: 400 },
  ]);
  assert.equal(report.pendingCount, 50);
  assert.equal(report.complete, false);
});

test('preview limit does not discover facets or crawl the entire catalog', async () => {
  let calls = 0;
  await fetchVtexCatalog(
    {
      sourceUrl: config.sourceUrl,
      sourceConfig: { ...config, searchStrategy: 'intelligent-search' },
      targetCount: 5,
    },
    async () => {
      calls++;
      return {
        status: 200,
        body: {
          products: Array.from({ length: 50 }, (_, i) => raw(String(i))),
          recordsFiltered: 5986,
        },
      };
    }
  );
  assert.equal(calls, 1);
});

test('legacy partitions overflowing categories and reports unknown coverage conservatively', async () => {
  let report: any;
  const catalog = Array.from({ length: 3000 }, (_, i) => raw(String(i)));
  const products = await fetchVtexCatalog(
    {
      sourceUrl: config.sourceUrl,
      sourceConfig: { ...config, searchStrategy: 'legacy' },
      report: (r) => {
        report = r;
      },
    },
    async (value) => {
      const url = new URL(value);
      if (url.pathname.includes('/category/tree/'))
        return { status: 200, body: [{ id: 1, children: [{ id: 11 }, { id: 12 }] }] };
      const rows =
        url.searchParams.get('fq') === 'C:/11/'
          ? catalog.slice(0, 1600)
          : url.searchParams.get('fq') === 'C:/12/'
            ? catalog.slice(1500)
            : catalog;
      const from = Number(url.searchParams.get('_from'));
      const to = Number(url.searchParams.get('_to'));
      assert.ok(to < 2500);
      return { status: 200, body: rows.slice(from, to + 1) };
    }
  );
  assert.equal(products.length, 3000);
  assert.equal(report.observed, 3000);
  assert.equal(
    report.complete,
    false,
    'Without the root total, leaf success is not proof of full coverage.'
  );
  assert.equal(report.estimatedTotal, undefined);
});

test('an inaccessible subdivision stops recovery without silently using another context', async () => {
  await assert.rejects(
    fetchVtexCatalog(
      {
        sourceUrl: config.sourceUrl,
        sourceConfig: { ...config, searchStrategy: 'intelligent-search' },
      },
      async (value) => {
        const url = new URL(value);
        if (url.pathname.includes('/facets/')) return { status: 403, body: null };
        const page = Number(url.searchParams.get('page'));
        return {
          status: 200,
          body: {
            products: Array.from({ length: 50 }, (_, i) => raw(String((page - 1) * 50 + i))),
            recordsFiltered: 3000,
          },
        };
      }
    ),
    SourceHttpError
  );
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
