import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Keep the resilient-fetch throttle/backoff out of the way so the mocked-fetch
// suite stays fast (real timing is covered in util.test.ts).
process.env.DEMO_IMPORT_THROTTLE_MS = '0';
process.env.DEMO_IMPORT_BACKOFF_BASE_MS = '1';

import { wooCommerceImporter } from './woocommerce.ts';
import { vtexImporter } from './vtex.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
}

function wooProduct(id: number): Record<string, unknown> {
  return {
    id,
    name: `Depot product ${id}`,
    sku: `SKU${id}`,
    prices: {
      price: '12300',
      regular_price: '15000',
      currency_minor_unit: 2,
    },
    images: [],
    categories: [],
    is_in_stock: true,
  };
}

function vtexProduct(productId: string, ean: string): Record<string, unknown> {
  return {
    productId,
    productName: `Equus product ${productId}`,
    brand: 'Equus',
    categories: ['/CATEGORIAS/Abrigos/'],
    items: [
      {
        ean,
        images: [],
        sellers: [
          {
            commertialOffer: {
              Price: 79900,
              ListPrice: 89900,
              AvailableQuantity: 10,
            },
          },
        ],
      },
    ],
  };
}

/** A VTEX apparel product whose sizes are separate SKUs under a "Talle" dimension. */
function vtexApparelProduct(
  productId: string,
  sizes: Array<{ size: string; ean: string; available?: number }>,
): Record<string, unknown> {
  return {
    productId,
    productName: `Vestido ${productId}`,
    brand: 'Adidas',
    categories: ['/Indumentaria/Vestido/'],
    items: sizes.map(({ size, ean, available = 5 }) => ({
      ean,
      variations: ['Talle'],
      Talle: [size],
      images: [],
      sellers: [
        { commertialOffer: { Price: 50000, ListPrice: 60000, AvailableQuantity: available } },
      ],
    })),
  };
}

test('demo-store importers fetch complete catalogs and recover from common source quirks', async () => {
  {
    const products = Array.from({ length: 1198 }, (_, index) => wooProduct(index + 1));

    globalThis.fetch = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/products/categories')) {
        return jsonResponse([]);
      }
      const page = Number(new URL(url).searchParams.get('page') ?? '1');
      const start = (page - 1) * 100;
      const body = products.slice(start, start + 100);
      return jsonResponse(body, {
        headers: {
          'X-WP-Total': String(products.length),
          'X-WP-TotalPages': String(Math.ceil(products.length / 100)),
        },
      });
    };

    const result = await wooCommerceImporter({
      sourceUrl: 'https://depotexpress.com.ar',
    });

    assert.equal(result.length, 1198);
  }

  {
    const products = Array.from({ length: 1198 }, (_, index) => wooProduct(index + 1));

    globalThis.fetch = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/products/categories')) {
        return jsonResponse([]);
      }
      const page = Number(new URL(url).searchParams.get('page') ?? '1');
      const start = (page - 1) * 100;
      return jsonResponse(products.slice(start, start + 100));
    };

    const result = await wooCommerceImporter({
      sourceUrl: 'https://depotexpress.com.ar',
      targetCount: 250,
    });

    assert.equal(result.length, 250);
  }

  {
    globalThis.fetch = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith('https://depotexpress.com.ar/')) {
        return jsonResponse({ code: 'not_found' }, { status: 404 });
      }
      if (url.includes('/products/categories')) {
        return jsonResponse([]);
      }
      return jsonResponse([wooProduct(1)]);
    };

    const result = await wooCommerceImporter({
      sourceUrl: 'https://depotexpress.com.ar',
    });

    assert.equal(result.length, 1);
    assert.equal(result[0]?.productId, '1');
  }

  {
    globalThis.fetch = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/category/tree/3')) {
        return jsonResponse([
          {
            id: 65,
            name: 'CATEGORIAS',
            hasChildren: true,
            children: [{ id: 1, name: 'Calzados', hasChildren: false, children: [] }],
          },
        ]);
      }
      if (url.includes('fq=C:/')) {
        return jsonResponse([]);
      }
      if (url.includes('_from=0&_to=49')) {
        return jsonResponse([
          vtexProduct('6329', '00S'),
          vtexProduct('6347', '00S'),
          vtexProduct('6339', '00S'),
        ]);
      }
      return jsonResponse([]);
    };

    const result = await vtexImporter({ sourceUrl: 'https://www.equus.com.ar' });

    assert.equal(result.length, 3);
    assert.deepEqual(
      result.map((product) => product.productId),
      ['6329', '6347', '6339'],
    );
  }

  {
    globalThis.fetch = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith('https://equus.com.ar/')) {
        return jsonResponse({ code: 'not_found' }, { status: 404 });
      }
      if (url.includes('/category/tree/3')) {
        return jsonResponse([]);
      }
      if (url.includes('_from=0&_to=49')) {
        return jsonResponse([vtexProduct('6329', '00S')]);
      }
      return jsonResponse([]);
    };

    const result = await vtexImporter({ sourceUrl: 'https://equus.com.ar' });

    assert.equal(result.length, 1);
    assert.equal(result[0]?.productId, '6329');
  }
});

test('vtex importer extracts size variants from a product with multiple SKUs', async () => {
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/category/tree/3')) return jsonResponse([]);
    if (url.includes('_from=0&_to=49')) {
      return jsonResponse([
        vtexApparelProduct('4068', [
          { size: 'S', ean: '4068821866669' },
          { size: 'M', ean: '4068821866676' },
          { size: 'L', ean: '4068821866683', available: 0 }, // out of stock → dropped
        ]),
      ]);
    }
    return jsonResponse([]);
  };

  const result = await vtexImporter({ sourceUrl: 'https://www.dashdeportes.com.ar' });

  assert.equal(result.length, 1);
  const product = result[0]!;
  assert.equal(product.optionTitle, 'Talle');
  assert.equal(product.variants?.length, 2); // L is out of stock
  assert.deepEqual(
    product.variants?.map((variant) => variant.value),
    ['S', 'M'],
  );
  assert.deepEqual(
    product.variants?.map((variant) => variant.ean),
    ['4068821866669', '4068821866676'],
  );
  // Product-level fields come from the first sellable SKU.
  assert.equal(product.ean, '4068821866669');
  assert.equal(product.price, 50000);
});
