import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STRATEGY_CONFIG_DEFAULTS } from '../config';
import { rankSimilar, scoreSimilarity, type SimilarityInput } from './similarity-scoring';

const W = STRATEGY_CONFIG_DEFAULTS.similarity_weights;

const input = (overrides: Partial<SimilarityInput> = {}): SimilarityInput => ({
  category_ids: [],
  tag_values: [],
  collection_id: null,
  type_id: null,
  brand_id: null,
  ...overrides,
});

describe('scoreSimilarity', () => {
  it('un producto idéntico puntúa 1', () => {
    const product = input({
      category_ids: ['cat_a', 'cat_root'],
      tag_values: ['verano', 'oferta'],
      collection_id: 'col_1',
      type_id: 'type_1',
      brand_id: 'brand_1',
    });
    assert.equal(scoreSimilarity(product, product, W), 1);
  });

  it('productos sin nada en común puntúan 0', () => {
    const a = input({ category_ids: ['cat_a'], collection_id: 'col_1' });
    const b = input({ category_ids: ['cat_b'], collection_id: 'col_2' });
    assert.equal(scoreSimilarity(a, b, W), 0);
  });

  it('crece con las categorías compartidas', () => {
    const source = input({ category_ids: ['cat_a', 'cat_b', 'cat_root'] });
    const one = scoreSimilarity(source, input({ category_ids: ['cat_a'] }), W);
    const two = scoreSimilarity(source, input({ category_ids: ['cat_a', 'cat_b'] }), W);
    const all = scoreSimilarity(source, input({ category_ids: ['cat_a', 'cat_b', 'cat_root'] }), W);
    assert.ok(one < two && two < all);
  });

  it('el Jaccard de categorías es correcto', () => {
    // 1 en común sobre 3 distintas = 1/3; con peso de categoría 0.4 sobre 1.0 total.
    const score = scoreSimilarity(
      input({ category_ids: ['cat_a', 'cat_b'] }),
      input({ category_ids: ['cat_a', 'cat_c'] }),
      W,
    );
    assert.equal(score, Math.round((W.category * (1 / 3)) * 10_000) / 10_000);
  });

  it('el Jaccard de tags es correcto', () => {
    const score = scoreSimilarity(
      input({ tag_values: ['a', 'b'] }),
      input({ tag_values: ['a', 'b'] }),
      W,
    );
    assert.equal(score, W.tags);
  });

  it('misma colección, tipo y marca suman', () => {
    const source = input({ collection_id: 'col_1', type_id: 'type_1', brand_id: 'brand_1' });
    assert.equal(
      scoreSimilarity(source, source, W),
      Math.round((W.collection + W.type + W.brand) * 10_000) / 10_000,
    );
  });

  it('un null no cuenta como coincidencia', () => {
    // Dos productos sin colección no son "de la misma colección".
    const a = input({ category_ids: ['cat_a'], collection_id: null });
    const b = input({ category_ids: ['cat_a'], collection_id: null });
    assert.equal(scoreSimilarity(a, b, W), W.category);
  });

  it('redistribuye el peso cuando una señal no está disponible', () => {
    // Sin tags en el catálogo, "coincide en todo lo comparable" tiene que seguir
    // dando 1: si no, los umbrales quedarían corridos según el catálogo.
    const product = input({
      category_ids: ['cat_a'],
      collection_id: 'col_1',
      type_id: 'type_1',
      brand_id: 'brand_1',
    });
    assert.equal(scoreSimilarity(product, product, W, { tags: false, brand: true }), 1);
    assert.equal(scoreSimilarity(product, product, W, { tags: false, brand: false }), 1);
  });

  it('sin tags disponibles el score de categorías sube', () => {
    const source = input({ category_ids: ['cat_a'] });
    const withTags = scoreSimilarity(source, input({ category_ids: ['cat_a'] }), W);
    const withoutTags = scoreSimilarity(source, input({ category_ids: ['cat_a'] }), W, {
      tags: false,
      brand: true,
    });
    assert.ok(withoutTags > withTags);
  });

  it('devuelve 0 si todos los pesos son 0', () => {
    const product = input({ category_ids: ['cat_a'] });
    assert.equal(
      scoreSimilarity(product, product, { category: 0, tags: 0, collection: 0, type: 0, brand: 0 }),
      0,
    );
  });

  it('el score siempre queda en [0, 1]', () => {
    const product = input({
      category_ids: ['cat_a'],
      tag_values: ['t'],
      collection_id: 'c',
      type_id: 't',
      brand_id: 'b',
    });
    const score = scoreSimilarity(product, product, {
      category: 10,
      tags: 10,
      collection: 10,
      type: 10,
      brand: 10,
    });
    assert.ok(score >= 0 && score <= 1);
  });

  it('es simétrico', () => {
    const a = input({ category_ids: ['cat_a', 'cat_b'], tag_values: ['x'], brand_id: 'b1' });
    const b = input({ category_ids: ['cat_b'], tag_values: ['x', 'y'], brand_id: 'b2' });
    assert.equal(scoreSimilarity(a, b, W), scoreSimilarity(b, a, W));
  });
});

describe('rankSimilar', () => {
  const candidate = (id: string, score: number) => ({ target_product_id: id, score });

  it('ordena por score descendente y recorta', () => {
    const ranked = rankSimilar(
      [candidate('c', 0.2), candidate('a', 0.9), candidate('b', 0.5)],
      2,
    );
    assert.deepEqual(
      ranked.map((r) => r.target_product_id),
      ['a', 'b'],
    );
  });

  it('descarta los de score 0', () => {
    // No comparten nada comparable: recomendarlos es peor que no recomendar.
    const ranked = rankSimilar([candidate('a', 0), candidate('b', 0.1)], 10);
    assert.deepEqual(
      ranked.map((r) => r.target_product_id),
      ['b'],
    );
  });

  it('desempata de forma determinista', () => {
    const ranked = rankSimilar([candidate('zzz', 0.5), candidate('aaa', 0.5)], 10);
    assert.deepEqual(
      ranked.map((r) => r.target_product_id),
      ['aaa', 'zzz'],
    );
  });

  it('no muta la entrada', () => {
    const items = [candidate('b', 0.1), candidate('a', 0.9)];
    rankSimilar(items, 10);
    assert.equal(items[0]?.target_product_id, 'b');
  });
});
