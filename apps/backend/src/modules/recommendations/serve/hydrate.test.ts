import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hydrateProducts, normalizeProduct, resetBrandProbe } from './hydrate';

const queryContext = (context: Record<string, unknown>) => ({ __context: context });

/** Graph de mentira: captura la config y devuelve filas fijas. */
const fakeQuery = (
  rows: unknown[],
  options: { failOnBrand?: boolean } = {},
) => {
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    graph: async (config: Record<string, unknown>) => {
      calls.push(config);
      const fields = (config.fields ?? []) as string[];
      if (options.failOnBrand && fields.some((f) => f.startsWith('brand.'))) {
        throw new Error('brand link not found');
      }
      return { data: rows };
    },
  };
};

describe('normalizeProduct', () => {
  it('incluye las categorías padre en category_ids', () => {
    // Es lo que hace que "misma categoría" matchee por RAMA del árbol: dos productos
    // de subcategorías hermanas cuentan como de la misma categoría.
    const product = normalizeProduct({
      id: 'prod_1',
      categories: [{ id: 'cat_leaf', parent_category: { id: 'cat_parent' } }],
    });
    assert.deepEqual(product.category_ids.sort(), ['cat_leaf', 'cat_parent']);
  });

  it('deduplica categorías repetidas entre hojas hermanas', () => {
    const product = normalizeProduct({
      id: 'prod_1',
      categories: [
        { id: 'cat_a', parent_category: { id: 'cat_root' } },
        { id: 'cat_b', parent_category: { id: 'cat_root' } },
      ],
    });
    assert.equal(product.category_ids.filter((id) => id === 'cat_root').length, 1);
  });

  it('usa la marca del link cuando está', () => {
    const product = normalizeProduct({
      id: 'prod_1',
      brand: { id: 'brand_1', name: 'Materia' },
    });
    assert.equal(product.brand_id, 'brand_1');
    assert.equal(product.brand_name, 'Materia');
  });

  it('cae a metadata.brand cuando no hay link de marca', () => {
    // Sin la extensión `brands`, la marca vive en metadata (mismo criterio que el
    // mapper de Typesense). El id sintético permite que "misma marca" siga andando.
    const product = normalizeProduct({ id: 'prod_1', metadata: { brand: 'Materia' } });
    assert.equal(product.brand_name, 'Materia');
    assert.equal(product.brand_id, 'metadata:materia');
  });

  it('normaliza el id sintético de marca sin importar el caseo', () => {
    const a = normalizeProduct({ id: 'a', metadata: { brand: 'Materia' } });
    const b = normalizeProduct({ id: 'b', metadata: { brand: 'MATERIA' } });
    assert.equal(a.brand_id, b.brand_id);
  });

  it('deja la marca en null cuando no hay ninguna fuente', () => {
    const product = normalizeProduct({ id: 'prod_1' });
    assert.equal(product.brand_id, null);
    assert.equal(product.brand_name, null);
  });

  it('suma el stock de todos los niveles de todas las ubicaciones', () => {
    const product = normalizeProduct({
      id: 'prod_1',
      variants: [
        {
          id: 'v1',
          inventory_items: [
            { inventory: { location_levels: [{ available_quantity: 3 }, { available_quantity: 4 }] } },
            { inventory: { location_levels: [{ available_quantity: 5 }] } },
          ],
        },
      ],
    });
    assert.equal(product.variants[0]?.available, 12);
  });

  it('trata el stock faltante como 0 sin explotar', () => {
    const product = normalizeProduct({
      id: 'prod_1',
      variants: [
        { id: 'v1' },
        { id: 'v2', inventory_items: [{ inventory: null }] },
        { id: 'v3', inventory_items: [{ inventory: { location_levels: [{ available_quantity: null }] } }] },
      ],
    });
    assert.deepEqual(
      product.variants.map((v) => v.available),
      [0, 0, 0],
    );
  });

  it('proyecta precios y tags', () => {
    const product = normalizeProduct({
      id: 'prod_1',
      tags: [{ value: 'oferta' }, { value: null }, { value: '' }],
      sales_channels: [{ id: 'sc_1' }, { id: null }],
      variants: [
        {
          id: 'v1',
          calculated_price: { calculated_amount: 900, original_amount: 1200, currency_code: 'ars' },
        },
      ],
    });
    assert.deepEqual(product.tag_values, ['oferta']);
    assert.deepEqual(product.sales_channel_ids, ['sc_1']);
    assert.equal(product.variants[0]?.calculated_amount, 900);
    assert.equal(product.variants[0]?.original_amount, 1200);
  });

  it('tolera un producto pelado', () => {
    const product = normalizeProduct({ id: 'prod_1' });
    assert.deepEqual(product.variants, []);
    assert.deepEqual(product.category_ids, []);
    assert.deepEqual(product.tag_values, []);
    assert.deepEqual(product.sales_channel_ids, []);
    assert.equal(product.metadata, null);
  });
});

describe('hydrateProducts', () => {
  it('no consulta con lista vacía', async () => {
    const query = fakeQuery([]);
    const result = await hydrateProducts(query, queryContext, {
      product_ids: [],
      currency_code: 'ars',
    });
    assert.equal(result.size, 0);
    assert.equal(query.calls.length, 0);
  });

  it('deduplica ids y filtra por publicado', async () => {
    resetBrandProbe();
    const query = fakeQuery([{ id: 'prod_1' }]);
    await hydrateProducts(query, queryContext, {
      product_ids: ['prod_1', 'prod_1', 'prod_2'],
      currency_code: 'ars',
      region_id: 'reg_1',
    });
    const call = query.calls[0];
    assert.deepEqual((call?.filters as Record<string, unknown>)?.id, ['prod_1', 'prod_2']);
    assert.equal((call?.filters as Record<string, unknown>)?.status, 'published');
  });

  it('pasa moneda y región en el contexto de precio', async () => {
    // Sin contexto de precio las variantes no traen `calculated_price` y TODO se
    // descartaría por `no_price`.
    resetBrandProbe();
    const query = fakeQuery([{ id: 'prod_1' }]);
    await hydrateProducts(query, queryContext, {
      product_ids: ['prod_1'],
      currency_code: 'ars',
      region_id: 'reg_1',
    });
    const context = query.calls[0]?.context as { variants: { calculated_price: unknown } };
    assert.deepEqual(context.variants.calculated_price, {
      __context: { currency_code: 'ars', region_id: 'reg_1' },
    });
  });

  it('omite region_id del contexto cuando no hay región', async () => {
    resetBrandProbe();
    const query = fakeQuery([{ id: 'prod_1' }]);
    await hydrateProducts(query, queryContext, { product_ids: ['prod_1'], currency_code: 'ars' });
    const context = query.calls[0]?.context as { variants: { calculated_price: { __context: object } } };
    assert.deepEqual(context.variants.calculated_price.__context, { currency_code: 'ars' });
  });

  it('reintenta sin campos de marca cuando el link no existe', async () => {
    // La extensión `brands` es opcional: pedir `brand.*` sin ella hace fallar la
    // query entera, así que hay que degradar en vez de romper.
    resetBrandProbe();
    const query = fakeQuery([{ id: 'prod_1', metadata: { brand: 'Materia' } }], { failOnBrand: true });
    const result = await hydrateProducts(query, queryContext, {
      product_ids: ['prod_1'],
      currency_code: 'ars',
    });
    assert.equal(query.calls.length, 2);
    assert.ok((query.calls[0]?.fields as string[]).includes('brand.id'));
    assert.ok(!(query.calls[1]?.fields as string[]).includes('brand.id'));
    assert.equal(result.get('prod_1')?.brand_name, 'Materia');
  });

  it('recuerda que la marca no está y no vuelve a sondear', async () => {
    // El costo del fallback se paga como máximo una vez por proceso, no por request.
    resetBrandProbe();
    const first = fakeQuery([{ id: 'prod_1' }], { failOnBrand: true });
    await hydrateProducts(first, queryContext, { product_ids: ['prod_1'], currency_code: 'ars' });
    assert.equal(first.calls.length, 2);

    const second = fakeQuery([{ id: 'prod_1' }], { failOnBrand: true });
    await hydrateProducts(second, queryContext, { product_ids: ['prod_1'], currency_code: 'ars' });
    assert.equal(second.calls.length, 1);
    assert.ok(!(second.calls[0]?.fields as string[]).includes('brand.id'));
  });

  it('indexa por id y descarta filas sin id', async () => {
    resetBrandProbe();
    const query = fakeQuery([{ id: 'prod_1' }, {}, { id: 'prod_2' }]);
    const result = await hydrateProducts(query, queryContext, {
      product_ids: ['prod_1', 'prod_2'],
      currency_code: 'ars',
    });
    assert.deepEqual([...result.keys()], ['prod_1', 'prod_2']);
  });
});
