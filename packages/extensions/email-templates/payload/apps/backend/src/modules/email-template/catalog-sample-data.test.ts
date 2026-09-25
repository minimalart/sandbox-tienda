import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCatalogSampleProducts,
  formatCatalogAmount,
  parseFormattedAmount,
  fetchCatalogSampleProducts,
  withCatalogSampleData,
  type CatalogSampleProduct,
} from './catalog-sample-data';

/**
 * `applyCatalogSampleProducts` es lo que evita que una pinturería vea "Yerba
 * Mate Premium 1kg" en la vista previa de sus propios mails. Se prueba sola,
 * sin tocar la base, porque es la parte que decide QUÉ se reemplaza y cómo se
 * recomponen los totales — el I/O sólo le trae productos.
 */

const PINTURA_A: CatalogSampleProduct = {
  title: 'Látex Interior Blanco 4L',
  thumbnail: 'https://cdn.example/latex.jpg',
  variant_title: '4L',
  sku: 'LAT-4L',
  unit_price: 15000,
};
const PINTURA_B: CatalogSampleProduct = {
  title: 'Esmalte Sintético Negro 1L',
  thumbnail: 'https://cdn.example/esmalte.jpg',
  variant_title: '1L',
  sku: 'ESM-1L',
  unit_price: 8000,
};

test('order-confirmation: reemplaza order_items y recompone subtotal y total', () => {
  const sample = {
    display_id: '1042',
    order_items: [
      { title: 'Yerba Mate Premium 1kg', quantity: 2, unit_price_formatted: '3.500', line_total_formatted: '7.000', thumbnail: '' },
      { title: 'Termo Acero Inoxidable', quantity: 1, unit_price_formatted: '12.500', line_total_formatted: '12.500', thumbnail: '' },
    ],
    subtotal_formatted: '19.500',
    discounts: [{ label: 'Descuento bienvenida', amount_formatted: '1.000', makes_free: false }],
    shipping_display: 'Gratis',
    total: '18.500',
  };

  const result = applyCatalogSampleProducts(sample, [PINTURA_A, PINTURA_B]);

  assert.deepEqual(result.order_items, [
    { title: 'Látex Interior Blanco 4L', quantity: 2, unit_price_formatted: '15.000,00', line_total_formatted: '30.000,00', thumbnail: 'https://cdn.example/latex.jpg' },
    { title: 'Esmalte Sintético Negro 1L', quantity: 1, unit_price_formatted: '8.000,00', line_total_formatted: '8.000,00', thumbnail: 'https://cdn.example/esmalte.jpg' },
  ]);
  // subtotal = 30.000 + 8.000 = 38.000; total = subtotal - descuento(1.000) + envío(0)
  assert.equal(result.subtotal_formatted, '38.000,00');
  assert.equal(result.total, '37.000,00');
  // lo que no es un array de producto queda intacto
  assert.deepEqual(result.discounts, sample.discounts);
  assert.equal(result.display_id, '1042');
});

test('order-notification-admin: preserva los campos de stock que NO viajan al mail del cliente', () => {
  const sample = {
    order_items: [
      {
        title: 'Yerba Mate Premium 1kg',
        quantity: 2,
        unit_price_formatted: '3.500',
        line_total_formatted: '7.000',
        thumbnail: '',
        stock_status: 'available',
        stock_status_label: 'Stock disponible',
        stock_status_color: '#15803d',
        stock_available_label: '12',
      },
    ],
    subtotal_formatted: '7.000',
    discounts: [],
    shipping_display: '$ 2.500',
    total: '9.500',
  };

  const result = applyCatalogSampleProducts(sample, [PINTURA_A]);
  const [line] = result.order_items as Record<string, unknown>[];

  assert.equal(line.title, 'Látex Interior Blanco 4L');
  assert.equal(line.stock_status, 'available');
  assert.equal(line.stock_status_label, 'Stock disponible');
  assert.equal(line.stock_available_label, '12');
  // subtotal = 15.000 x 2 = 30.000; total = 30.000 - 0 + 2.500
  assert.equal(result.subtotal_formatted, '30.000,00');
  assert.equal(result.total, '32.500,00');
});

test('kit-cde-notification: un solo total, sin descuentos ni envío', () => {
  const sample = {
    order_items: [{ title: 'Yerba Mate Premium 1kg', quantity: 2, unit_price_formatted: '3.500', line_total_formatted: '7.000', thumbnail: '' }],
    order_total_formatted: '7.000',
    pickup_url: 'https://mercatto.app/pickup/validate/abc123',
  };

  const result = applyCatalogSampleProducts(sample, [PINTURA_B]);

  assert.equal(result.order_total_formatted, '16.000,00'); // 8.000 x 2
  assert.equal(result.pickup_url, sample.pickup_url);
});

test('recurring-order-created: items sin campos de precio, sólo se toca el título', () => {
  const sample = {
    customer_name: 'Juan Pérez',
    items: [
      { title: 'Leche entera 1L', quantity: 6 },
      { title: 'Pan lactal integral', quantity: 2 },
    ],
    manage_url: 'https://tienda.example.com/ar/account/subscriptions',
  };

  const result = applyCatalogSampleProducts(sample, [PINTURA_A, PINTURA_B]);

  assert.deepEqual(result.items, [
    { title: 'Látex Interior Blanco 4L', quantity: 6 },
    { title: 'Esmalte Sintético Negro 1L', quantity: 2 },
  ]);
});

test('menos productos reales que líneas de ejemplo: se acortan las líneas, no se repiten', () => {
  const sample = {
    order_items: [
      { title: 'Yerba Mate Premium 1kg', quantity: 2, thumbnail: '' },
      { title: 'Termo Acero Inoxidable', quantity: 1, thumbnail: '' },
    ],
  };

  const result = applyCatalogSampleProducts(sample, [PINTURA_A]);

  assert.equal((result.order_items as unknown[]).length, 1);
});

test('sin productos: el sample vuelve intacto (misma referencia de contenido)', () => {
  const sample = { order_items: [{ title: 'Yerba Mate Premium 1kg', quantity: 2 }] };
  const result = applyCatalogSampleProducts(sample, []);
  assert.deepEqual(result, sample);
});

test('descuento no parseable (`makes_free`): el total NO se inventa, el subtotal sí se recompone', () => {
  const sample = {
    order_items: [{ title: 'Yerba Mate Premium 1kg', quantity: 1, unit_price_formatted: '1', line_total_formatted: '1' }],
    subtotal_formatted: '1',
    discounts: [{ label: 'Envío gratis por promo', makes_free: true }],
    shipping_display: 'Gratis',
    total: '1',
  };

  const result = applyCatalogSampleProducts(sample, [PINTURA_A]);

  assert.equal(result.subtotal_formatted, '15.000,00');
  assert.equal(result.total, '1', 'sin poder leer el descuento, el total queda como estaba');
});

test('un array sin `title` en sus entradas (ej. discounts, timeline_steps) no se toca', () => {
  const sample = {
    timeline_steps: [{ label: 'Pago confirmado', done: true }],
    order_items: [{ title: 'Yerba Mate Premium 1kg', quantity: 1 }],
  };
  const result = applyCatalogSampleProducts(sample, [PINTURA_A]);
  assert.deepEqual(result.timeline_steps, sample.timeline_steps);
});

test('sample sin ningún array de producto: se devuelve tal cual', () => {
  const sample = { subject: 'Restablecer tu contraseña', link_reseteo: 'https://x' };
  const result = applyCatalogSampleProducts(sample, [PINTURA_A]);
  assert.deepEqual(result, sample);
});

test('sample null/undefined no rompe: devuelve {}', () => {
  assert.deepEqual(applyCatalogSampleProducts(null, [PINTURA_A]), {});
  assert.deepEqual(applyCatalogSampleProducts(undefined, [PINTURA_A]), {});
});

test('formatCatalogAmount: es-AR con dos decimales, null/NaN cae a 0,00', () => {
  assert.equal(formatCatalogAmount(1000), '1.000,00');
  assert.equal(formatCatalogAmount(null), '0,00');
  assert.equal(formatCatalogAmount(undefined), '0,00');
});

test('parseFormattedAmount: formatos es-AR con y sin decimales, y basura → null', () => {
  assert.equal(parseFormattedAmount('1.000,00'), 1000);
  assert.equal(parseFormattedAmount('3.500'), 3500);
  assert.equal(parseFormattedAmount('$ 2.500'), 2500);
  assert.equal(parseFormattedAmount('Gratis'), null);
  assert.equal(parseFormattedAmount(''), null);
  assert.equal(parseFormattedAmount(undefined), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Parte I/O: fetchCatalogSampleProducts / withCatalogSampleData
// ─────────────────────────────────────────────────────────────────────────────

/** Un `req` mínimo: resuelve QUERY/REGION/STORE por el registration key que le pidan. */
function fakeReq(opts: {
  graph: (input: Record<string, unknown>) => Promise<{ data: unknown[] }>;
  regions?: Array<{ id: string; currency_code?: string }>;
  stores?: Array<{ default_region_id?: string | null }>;
}) {
  const regions = opts.regions ?? [];
  const stores = opts.stores ?? [];
  return {
    scope: {
      resolve: (key: string) => {
        if (key === 'query') return { graph: opts.graph };
        if (key === 'region') {
          return {
            listRegions: async (filter: Record<string, unknown>) => {
              const id = filter.id as string | undefined;
              return regions.filter((r) => !id || r.id === id);
            },
          };
        }
        if (key === 'store') {
          return { listStores: async () => stores };
        }
        throw new Error(`unexpected resolve(${key})`);
      },
    },
  } as never;
}

const SITE_RESOLUTION = {
  status: 'site',
  site: { id: 'demo_pinturas', channel_ids: ['sc_pinturas'], region_id: 'reg_ar' },
} as never;

test('fetchCatalogSampleProducts: resuelve moneda por la región de la tienda y prioriza el que tiene miniatura', async () => {
  const req = fakeReq({
    graph: async (input) => {
      if (input.entity === 'product_sales_channel') {
        return { data: [{ product_id: 'prod_1' }, { product_id: 'prod_2' }] };
      }
      if (input.entity === 'product') {
        return {
          data: [
            {
              id: 'prod_1',
              title: 'Sin miniatura',
              thumbnail: null,
              variants: [{ title: 'Único', sku: 'A', prices: [{ amount: 100, currency_code: 'ars' }] }],
            },
            {
              id: 'prod_2',
              title: 'Con miniatura',
              thumbnail: 'https://cdn.example/x.jpg',
              variants: [{ title: 'Único', sku: 'B', prices: [{ amount: 200, currency_code: 'ars' }] }],
            },
          ],
        };
      }
      throw new Error(`unexpected entity ${input.entity}`);
    },
    regions: [{ id: 'reg_ar', currency_code: 'ars' }],
  });

  const products = await fetchCatalogSampleProducts(req, SITE_RESOLUTION);

  assert.equal(products.length, 2);
  assert.equal(products[0].title, 'Con miniatura', 'el que tiene miniatura va primero');
  assert.equal(products[0].unit_price, 200);
});

test('fetchCatalogSampleProducts: tienda sin productos en su canal → [] (no cae a "todo el catálogo")', async () => {
  const req = fakeReq({
    graph: async (input) => {
      if (input.entity === 'product_sales_channel') return { data: [] };
      throw new Error('no debería consultar product si no hay ids');
    },
    regions: [{ id: 'reg_ar', currency_code: 'ars' }],
  });

  const products = await fetchCatalogSampleProducts(req, SITE_RESOLUTION);
  assert.deepEqual(products, []);
});

test('fetchCatalogSampleProducts: la consulta falla → [] y nunca lanza', async () => {
  const req = fakeReq({
    graph: async () => {
      throw new Error('boom');
    },
  });
  const products = await fetchCatalogSampleProducts(req, SITE_RESOLUTION);
  assert.deepEqual(products, []);
});

test('withCatalogSampleData: sin catálogo resoluble, devuelve el sample original', async () => {
  const req = fakeReq({ graph: async () => { throw new Error('boom'); } });
  const sample = { order_items: [{ title: 'Yerba Mate Premium 1kg', quantity: 1 }] };

  const result = await withCatalogSampleData(req, SITE_RESOLUTION, undefined, sample);
  assert.deepEqual(result, sample);
});

test('withCatalogSampleData: sample null → {} y no rompe', async () => {
  const req = fakeReq({ graph: async () => ({ data: [] }) });
  const result = await withCatalogSampleData(req, SITE_RESOLUTION, undefined, null);
  assert.deepEqual(result, {});
});

/**
 * Un catálogo con UNA pintura. La consulta de existencia (`filters.title`) sólo
 * reconoce títulos de `enCatalogo`; la de candidatos devuelve la pintura.
 */
function reqConCatalogo(enCatalogo: string[] = [], opts: { candidatos?: boolean } = {}) {
  return fakeReq({
    graph: async (input) => {
      const filters = (input.filters ?? {}) as Record<string, unknown>;
      if (input.entity === 'product' && Array.isArray(filters.title)) {
        return {
          data: (filters.title as string[])
            .filter((t) => enCatalogo.includes(t))
            .map((t, i) => ({ id: `prod_real_${i}`, title: t })),
        };
      }
      if (input.entity === 'product_sales_channel') {
        if (Array.isArray(filters.product_id)) {
          return { data: (filters.product_id as string[]).map((id) => ({ product_id: id })) };
        }
        return { data: [{ product_id: 'prod_1' }] };
      }
      if (opts.candidatos === false) throw new Error('no debería buscar candidatos');
      return {
        data: [
          {
            id: 'prod_1',
            title: 'Látex Interior Blanco 4L',
            thumbnail: 'https://cdn.example/latex.jpg',
            variants: [{ title: '4L', sku: 'LAT-4L', prices: [{ amount: 15000, currency_code: 'ars' }] }],
          },
        ],
      };
    },
    regions: [{ id: 'reg_ar', currency_code: 'ars' }],
  });
}

const titlesOf = (r: Record<string, unknown>) => (r.order_items as Array<{ title: string }>).map((l) => l.title);

test('withCatalogSampleData: un producto que la tienda no tiene se reemplaza, venga o no `data`', async () => {
  const sample = { order_items: [{ title: 'Yerba Mate Premium 1kg', quantity: 1, thumbnail: '' }] };
  const conData = await withCatalogSampleData(reqConCatalogo(), SITE_RESOLUTION, sample, null);
  const sinData = await withCatalogSampleData(reqConCatalogo(), SITE_RESOLUTION, undefined, sample);
  assert.deepEqual(titlesOf(conData), ['Látex Interior Blanco 4L']);
  assert.deepEqual(titlesOf(sinData), ['Látex Interior Blanco 4L']);
});

test('withCatalogSampleData: productos que la tienda SÍ tiene quedan intactos, y no se buscan candidatos', async () => {
  // El caso de desdeelsur: el sample ya tiene productos reales. La versión que
  // comparaba contra el sample guardado los pisaba con otros.
  const sample = {
    order_items: [{ title: 'Satinol x4 lt', quantity: 1, color_label: 'Rosa Espléndido', line_total_formatted: '156.551,82' }],
    subtotal_formatted: '129.381,67',
    total: '156.551,82',
  };
  const result = await withCatalogSampleData(
    reqConCatalogo(['Satinol x4 lt'], { candidatos: false }),
    SITE_RESOLUTION,
    sample,
    sample,
  );
  assert.deepEqual(result, sample);
});

test('withCatalogSampleData: el sample de OTRA fila (Enviar prueba del par admin/cliente) también se corrige', async () => {
  const deLaOtraFila = { order_items: [{ title: 'Termo Acero Inoxidable', quantity: 1, stock_status: 'available' }] };
  const guardado = { order_items: [{ title: 'Yerba Mate Premium 1kg', quantity: 2 }] };
  const result = await withCatalogSampleData(reqConCatalogo(), SITE_RESOLUTION, deLaOtraFila, guardado);
  assert.deepEqual(titlesOf(result), ['Látex Interior Blanco 4L']);
});

test('withCatalogSampleData: si no se puede saber qué existe, no se reemplaza nada', async () => {
  const req = fakeReq({ graph: async () => { throw new Error('boom'); } });
  const sample = { order_items: [{ title: 'Yerba Mate Premium 1kg', quantity: 1 }] };
  assert.deepEqual(await withCatalogSampleData(req, SITE_RESOLUTION, sample, null), sample);
});

test('applyCatalogSampleProducts: mezcla — se conserva la línea real, se cambia la inventada y el color viejo no viaja', () => {
  const sample = {
    order_items: [
      { title: 'Satinol x4 lt', quantity: 1, color_label: 'Rosa Espléndido', color_hex: '#C95D73', line_total_formatted: '10.000,00', unit_price_formatted: '10.000,00' },
      { title: 'Yerba Mate Premium 1kg', quantity: 2, color_label: 'Rosa Espléndido', color_hex: '#C95D73', line_total_formatted: '7.000', unit_price_formatted: '3.500' },
    ],
    subtotal_formatted: '17.000',
    discounts: [],
    shipping_display: 'Gratis',
    total: '17.000',
  };
  const result = applyCatalogSampleProducts(sample, [PINTURA_A], { knownTitles: new Set(['Satinol x4 lt']) });
  const [kept, swapped] = result.order_items as Array<Record<string, unknown>>;
  assert.deepEqual(kept, sample.order_items[0]);
  assert.equal(swapped!.title, 'Látex Interior Blanco 4L');
  assert.equal('color_label' in swapped!, false);
  assert.equal('color_hex' in swapped!, false);
  // 10.000 (conservada) + 2 × 15.000 (nueva)
  assert.equal(result.subtotal_formatted, '40.000,00');
  assert.equal(result.total, '40.000,00');
});

test('applyCatalogSampleProducts: nunca repite un producto que ya está en el array', () => {
  const sample = {
    order_items: [
      { title: 'Látex Interior Blanco 4L', quantity: 1 },
      { title: 'Yerba Mate Premium 1kg', quantity: 1 },
    ],
  };
  const result = applyCatalogSampleProducts(sample, [PINTURA_A, PINTURA_B], {
    knownTitles: new Set(['Látex Interior Blanco 4L']),
  });
  assert.deepEqual(titlesOf(result), ['Látex Interior Blanco 4L', 'Esmalte Sintético Negro 1L']);
});
