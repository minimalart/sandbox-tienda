import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cosineSimilarity } from './embedding-client';
import { buildEmbedText } from './embed-catalog';
import type { GeoProductInput } from '../geo/types';

describe('cosineSimilarity', () => {
  it('es 1 para vectores idénticos y 0 para ortogonales', () => {
    assert.equal(Math.round(cosineSimilarity([1, 2, 3], [1, 2, 3])), 1);
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  });
  it('ordena por afinidad', () => {
    const q = [1, 1, 0];
    const near = cosineSimilarity(q, [1, 1, 0.1]);
    const far = cosineSimilarity(q, [0, 0, 1]);
    assert.ok(near > far);
  });
  it('tolera vectores de distinta longitud y ceros', () => {
    assert.equal(cosineSimilarity([0, 0], [0, 0]), 0);
    assert.ok(cosineSimilarity([1, 2, 3], [1, 2]) >= 0);
  });
});

describe('buildEmbedText', () => {
  it('arma un texto rico con título, marca, categorías, material y descripción', () => {
    const p: GeoProductInput = {
      id: 'p1',
      title: 'Mate imperial',
      subtitle: 'Con bombilla',
      description: '<p>Cuero premium 250ml</p>',
      material: 'cuero',
      weight: null,
      length: null,
      height: null,
      width: null,
      tags: ['mate'],
      categories: ['Mates'],
      collection: null,
      type: null,
      brand: 'Materia',
      variants: [],
      option_titles: [],
      images_count: 0,
      images_with_alt: 0,
      metadata_keys: [],
      has_faq: false,
    };
    const text = buildEmbedText(p);
    assert.ok(text.includes('Mate imperial'));
    assert.ok(text.includes('Marca: Materia'));
    assert.ok(text.includes('Categorías: Mates'));
    assert.ok(text.includes('Material: cuero'));
    assert.ok(!text.includes('<p>'), 'debe quitar HTML');
  });
});
