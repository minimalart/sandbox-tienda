import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { candidate, emptyContext, pair, product, variant } from './fixtures.test-helpers';
import { applyEligibilityFilters, referencePrice, stockOf } from './filters';
import type { EligibilityContext, HydratedProduct } from '../types';

const ctx = (overrides: Record<string, unknown> = {}) =>
  emptyContext(overrides) as unknown as EligibilityContext;

/** Envuelve un producto en el par que espera el filtro. */
const input = (p: HydratedProduct, candidateOverrides = {}) => [
  { candidate: candidate({ target_product_id: p.id, ...candidateOverrides }), product: p },
];

describe('stockOf', () => {
  it('trata manage_inventory=false como stock ilimitado', () => {
    // Un producto sin control de inventario NO está sin stock: es vendible siempre.
    assert.equal(stockOf(variant({ manage_inventory: false, available: 0 })), Number.POSITIVE_INFINITY);
  });

  it('devuelve el disponible cuando se controla inventario', () => {
    assert.equal(stockOf(variant({ manage_inventory: true, available: 3 })), 3);
    assert.equal(stockOf(variant({ manage_inventory: true, available: 0 })), 0);
  });
});

describe('referencePrice', () => {
  it('toma el precio más bajo de las variantes con stock', () => {
    const p = product({
      variants: [
        variant({ id: 'v1', calculated_amount: 5000 }),
        variant({ id: 'v2', calculated_amount: 2000 }),
      ],
    });
    assert.equal(referencePrice(p), 2000);
  });

  it('ignora las variantes sin stock', () => {
    const p = product({
      variants: [
        variant({ id: 'v1', calculated_amount: 900, available: 0 }),
        variant({ id: 'v2', calculated_amount: 4000, available: 2 }),
      ],
    });
    assert.equal(referencePrice(p), 4000);
  });

  it('devuelve null cuando ninguna variante tiene precio calculado', () => {
    assert.equal(referencePrice(product({ variants: [variant({ calculated_amount: null })] })), null);
  });
});

describe('applyEligibilityFilters — filtros obligatorios', () => {
  it('deja pasar un producto sano', () => {
    const { kept, discarded } = applyEligibilityFilters(input(product()), ctx());
    assert.equal(kept.length, 1);
    assert.deepEqual(discarded, {});
  });

  it('descarta el producto que no volvió de la hidratación', () => {
    const { kept, discarded } = applyEligibilityFilters(
      [{ candidate: candidate({ target_product_id: 'prod_gone' }), product: undefined }],
      ctx(),
    );
    assert.equal(kept.length, 0);
    assert.equal(discarded.not_hydrated, 1);
  });

  it('descarta productos sin variantes', () => {
    const { kept, discarded } = applyEligibilityFilters(input(product({ variants: [] })), ctx());
    assert.equal(kept.length, 0);
    assert.equal(discarded.no_variants, 1);
  });

  it('descarta productos sin stock', () => {
    const p = product({ variants: [variant({ available: 0 })] });
    const { kept, discarded } = applyEligibilityFilters(input(p), ctx());
    assert.equal(kept.length, 0);
    assert.equal(discarded.out_of_stock, 1);
  });

  it('acepta productos sin control de inventario aunque available sea 0', () => {
    const p = product({ variants: [variant({ manage_inventory: false, available: 0 })] });
    const { kept } = applyEligibilityFilters(input(p), ctx());
    assert.equal(kept.length, 1);
  });

  it('descarta productos de otro canal de venta', () => {
    const p = product({ sales_channel_ids: ['sc_other'] });
    const { kept, discarded } = applyEligibilityFilters(input(p), ctx());
    assert.equal(kept.length, 0);
    assert.equal(discarded.sales_channel, 1);
  });

  it('no filtra por canal cuando el request no manda canal', () => {
    // Recomendar de más es preferible a devolver vacío por un parámetro faltante.
    const p = product({ sales_channel_ids: ['sc_other'] });
    const { kept } = applyEligibilityFilters(input(p), ctx({ sales_channel_id: null }));
    assert.equal(kept.length, 1);
  });

  it('descarta productos sin precio para la región', () => {
    const p = product({ variants: [variant({ calculated_amount: null })] });
    const { kept, discarded } = applyEligibilityFilters(input(p), ctx());
    assert.equal(kept.length, 0);
    assert.equal(discarded.no_price, 1);
  });

  it('descarta productos ya presentes en el carrito', () => {
    const p = product({ id: 'prod_in_cart' });
    const { kept, discarded } = applyEligibilityFilters(
      input(p),
      ctx({ cart_product_ids: new Set(['prod_in_cart']) }),
    );
    assert.equal(kept.length, 0);
    assert.equal(discarded.in_cart, 1);
  });

  it('nunca recomienda el producto de origen', () => {
    const p = product({ id: 'prod_source' });
    const { kept, discarded } = applyEligibilityFilters(
      input(p),
      ctx({ source_product_id: 'prod_source' }),
    );
    assert.equal(kept.length, 0);
    assert.equal(discarded.source_product, 1);
  });

  it('respeta las exclusiones explícitas del cliente', () => {
    const p = product({ id: 'prod_x' });
    const { kept, discarded } = applyEligibilityFilters(
      input(p),
      ctx({ exclude_product_ids: new Set(['prod_x']) }),
    );
    assert.equal(kept.length, 0);
    assert.equal(discarded.excluded, 1);
  });

  it('deduplica el mismo producto que llega por dos relaciones', () => {
    const p = product({ id: 'prod_dup' });
    const { kept, discarded } = applyEligibilityFilters(
      [
        { candidate: candidate({ target_product_id: 'prod_dup', relation_type: 'complementary' }), product: p },
        { candidate: candidate({ target_product_id: 'prod_dup', relation_type: 'accessory' }), product: p },
      ],
      ctx(),
    );
    assert.equal(kept.length, 1);
    assert.equal(kept[0].candidate.relation_type, 'complementary'); // gana el primero (mejor ranking)
    assert.equal(discarded.duplicate, 1);
  });

  it('reporta la causa raíz y no un síntoma', () => {
    // Sin stock Y sin precio: tiene que reportarse como out_of_stock, que es lo
    // que hay que arreglar, no como no_price.
    const p = product({ variants: [variant({ available: 0, calculated_amount: null })] });
    const { discarded } = applyEligibilityFilters(input(p), ctx());
    assert.equal(discarded.out_of_stock, 1);
    assert.equal(discarded.no_price, undefined);
  });
});

describe('applyEligibilityFilters — filtros configurables', () => {
  it('aplica el rango de precio', () => {
    const p = product({ variants: [variant({ calculated_amount: 3000 })] });
    assert.equal(applyEligibilityFilters(input(p), ctx(), { price_min: 5000 }).kept.length, 0);
    assert.equal(applyEligibilityFilters(input(p), ctx(), { price_max: 1000 }).kept.length, 0);
    assert.equal(
      applyEligibilityFilters(input(p), ctx(), { price_min: 1000, price_max: 5000 }).kept.length,
      1,
    );
  });

  it('same_category matchea también por categoría padre', () => {
    // Las categorías hidratadas incluyen los padres, así que "misma categoría"
    // funciona por rama y no sólo por la hoja exacta.
    const source = product({ id: 'prod_src', category_ids: ['cat_leaf', 'cat_parent'] });
    const target = product({ id: 'prod_t', category_ids: ['cat_other_leaf', 'cat_parent'] });
    const { kept } = applyEligibilityFilters(
      input(target),
      ctx({ source_product_id: source.id, source_product: source }),
      { same_category: true },
    );
    assert.equal(kept.length, 1);
  });

  it('same_category descarta cuando no hay rama en común', () => {
    const source = product({ id: 'prod_src', category_ids: ['cat_a'] });
    const target = product({ id: 'prod_t', category_ids: ['cat_b'] });
    const { kept, discarded } = applyEligibilityFilters(
      input(target),
      ctx({ source_product_id: source.id, source_product: source }),
      { same_category: true },
    );
    assert.equal(kept.length, 0);
    assert.equal(discarded.same_category, 1);
  });

  it('ignora same_category cuando no hay producto de origen', () => {
    // Trending / popular / bridge no tienen origen: el filtro no puede aplicarse y
    // no debe vaciar la respuesta.
    const target = product({ category_ids: ['cat_b'] });
    const { kept } = applyEligibilityFilters(input(target), ctx(), { same_category: true });
    assert.equal(kept.length, 1);
  });

  it('different_category es el complemento exacto de same_category', () => {
    const source = product({ id: 'prod_src', category_ids: ['cat_a'] });
    const same = product({ id: 'prod_same', category_ids: ['cat_a'] });
    const other = product({ id: 'prod_other', category_ids: ['cat_b'] });
    const context = ctx({ source_product_id: source.id, source_product: source });
    assert.equal(applyEligibilityFilters(input(same), context, { different_category: true }).kept.length, 0);
    assert.equal(applyEligibilityFilters(input(other), context, { different_category: true }).kept.length, 1);
  });

  it('same_brand compara por brand_id', () => {
    const source = product({ id: 'prod_src', brand_id: 'brand_a' });
    const same = product({ id: 'prod_same', brand_id: 'brand_a' });
    const other = product({ id: 'prod_other', brand_id: 'brand_b' });
    const context = ctx({ source_product_id: source.id, source_product: source });
    assert.equal(applyEligibilityFilters(input(same), context, { same_brand: true }).kept.length, 1);
    const rejected = applyEligibilityFilters(input(other), context, { same_brand: true });
    assert.equal(rejected.kept.length, 0);
    assert.equal(rejected.discarded.same_brand, 1);
  });

  it('excluye categorías vetadas', () => {
    const p = product({ category_ids: ['cat_adult'] });
    const { kept, discarded } = applyEligibilityFilters(input(p), ctx(), {
      excluded_category_ids: ['cat_adult'],
    });
    assert.equal(kept.length, 0);
    assert.equal(discarded.excluded_category, 1);
  });

  it('exige al menos uno de los tags requeridos', () => {
    const withTag = product({ id: 'prod_a', tag_values: ['oferta', 'verano'] });
    const without = product({ id: 'prod_b', tag_values: ['invierno'] });
    assert.equal(applyEligibilityFilters(input(withTag), ctx(), { required_tags: ['oferta'] }).kept.length, 1);
    assert.equal(applyEligibilityFilters(input(without), ctx(), { required_tags: ['oferta'] }).kept.length, 0);
  });

  it('descarta tags vetados', () => {
    const p = product({ tag_values: ['descontinuado'] });
    const { kept, discarded } = applyEligibilityFilters(input(p), ctx(), {
      excluded_tags: ['descontinuado'],
    });
    assert.equal(kept.length, 0);
    assert.equal(discarded.excluded_tags, 1);
  });

  it('matchea metadata comparando como string', () => {
    const p = product({ metadata: { linea: 'premium', destacado: true } });
    assert.equal(
      applyEligibilityFilters(input(p), ctx(), { metadata_match: { linea: 'premium' } }).kept.length,
      1,
    );
    assert.equal(
      applyEligibilityFilters(input(p), ctx(), { metadata_match: { destacado: true } }).kept.length,
      1,
    );
    assert.equal(
      applyEligibilityFilters(input(p), ctx(), { metadata_match: { linea: 'basica' } }).kept.length,
      0,
    );
  });

  it('combina varios filtros y descarta por el primero que falla', () => {
    const source = product({ id: 'prod_src', category_ids: ['cat_a'], brand_id: 'brand_a' });
    const target = product({
      id: 'prod_t',
      category_ids: ['cat_a'],
      brand_id: 'brand_b',
      tag_values: ['oferta'],
      variants: [variant({ calculated_amount: 2000 })],
    });
    const { kept, discarded } = applyEligibilityFilters(
      input(target),
      ctx({ source_product_id: source.id, source_product: source }),
      { same_category: true, same_brand: true, required_tags: ['oferta'], price_max: 5000 },
    );
    assert.equal(kept.length, 0);
    assert.equal(discarded.same_brand, 1);
  });

  it('cuenta los descartes por razón sobre un lote mixto', () => {
    const items = [
      ...input(product({ id: 'ok_1' })),
      ...input(product({ id: 'sin_stock', variants: [variant({ available: 0 })] })),
      ...input(product({ id: 'otro_canal', sales_channel_ids: ['sc_x'] })),
      ...input(product({ id: 'en_carrito' })),
      ...input(product({ id: 'ok_2' })),
    ];
    const { kept, discarded } = applyEligibilityFilters(
      items,
      ctx({ cart_product_ids: new Set(['en_carrito']) }),
    );
    assert.deepEqual(
      kept.map((k) => k.product.id),
      ['ok_1', 'ok_2'],
    );
    assert.deepEqual(discarded, { out_of_stock: 1, sales_channel: 1, in_cart: 1 });
  });
});

describe('applyEligibilityFilters — invariantes', () => {
  it('no muta la entrada', () => {
    const items = [...input(product({ id: 'a' })), ...input(product({ id: 'b' }))];
    const snapshot = JSON.stringify(items);
    applyEligibilityFilters(items, ctx());
    assert.equal(JSON.stringify(items), snapshot);
  });

  it('conserva el orden de entrada de los que sobreviven', () => {
    // El ranking corre ANTES del filtro, así que el filtro no puede reordenar.
    const items = ['c', 'a', 'b'].flatMap((id) => input(product({ id })));
    const { kept } = applyEligibilityFilters(items, ctx());
    assert.deepEqual(
      kept.map((k) => k.product.id),
      ['c', 'a', 'b'],
    );
  });

  it('con lista vacía devuelve vacío sin descartes', () => {
    assert.deepEqual(applyEligibilityFilters([], ctx()), { kept: [], discarded: {} });
  });
});

describe('pair (fixture)', () => {
  it('mantiene coherente el id entre candidato y producto', () => {
    const p = pair({ id: 'prod_z' });
    assert.equal(p.candidate.target_product_id, 'prod_z');
  });
});
