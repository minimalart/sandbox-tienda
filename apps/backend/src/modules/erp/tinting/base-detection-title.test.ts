import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { baseDetectionTitle, sourceTitleOf } from './base-detection-title.ts';
import { parseTintingBase } from './parse-base.ts';

describe('sourceTitleOf', () => {
  it('lee el título crudo que deja el sync', () => {
    assert.equal(
      sourceTitleOf({ zeus_source_title: 'ALBALATEX MATE INTERIOR BASE F X 3,6 LTS' }),
      'ALBALATEX MATE INTERIOR BASE F X 3,6 LTS'
    );
  });

  it('acepta la clave sin prefijo de proveedor', () => {
    assert.equal(sourceTitleOf({ source_title: 'X BASE F X 1 LT' }), 'X BASE F X 1 LT');
  });

  it('ignora metadata que no sirve', () => {
    assert.equal(sourceTitleOf(null), null);
    assert.equal(sourceTitleOf('no soy un objeto'), null);
    assert.equal(sourceTitleOf({ zeus_source_title: '   ' }), null);
    assert.equal(sourceTitleOf({ zeus_source_title: 42 }), null);
  });
});

describe('baseDetectionTitle', () => {
  it('prefiere el título crudo del ERP al del producto', () => {
    assert.equal(
      baseDetectionTitle({
        metadata: { zeus_source_title: 'ALBALATEX MATE INTERIOR BASE F X 3,6 LTS' },
        product: { title: 'Albalatex mate interior x4 lt' },
      }),
      'ALBALATEX MATE INTERIOR BASE F X 3,6 LTS'
    );
  });

  it('cae al título del producto cuando no hay crudo', () => {
    assert.equal(
      baseDetectionTitle({ product: { title: 'ALBACRYL BASE P X 1 LT' } }),
      'ALBACRYL BASE P X 1 LT'
    );
  });

  it('cae al de la variante cuando tampoco hay producto', () => {
    assert.equal(baseDetectionTitle({ title: 'MARMOL BASE X 3,24 LTS' }), 'MARMOL BASE X 3,24 LTS');
  });

  it('sin nada devuelve cadena vacía y no rompe al parser', () => {
    assert.equal(baseDetectionTitle({}), '');
    assert.equal(parseTintingBase(baseDetectionTitle({})), null);
  });
});

/**
 * El bug entero, en un test: el normalizador saca el `Base F` del título (R26),
 * así que detectar sobre el título de Medusa devolvía `null` y la base quedaba
 * invisible para siempre. Es el estado real de los artículos que entraron por el
 * catalog sync.
 */
describe('detección sobre una base ya normalizada por el sync', () => {
  const variant = {
    metadata: { zeus_source_title: 'ALBALATEX DESIGN MATE INTERIOR BASE P X 3,6 LTS.' },
    product: { title: 'Albalatex design mate interior x4 lt' },
  };

  it('el título de Medusa NO se puede parsear', () => {
    assert.equal(parseTintingBase(variant.product.title), null);
  });

  it('el título crudo sí, y sale la línea y la letra correctas', () => {
    const parsed = parseTintingBase(baseDetectionTitle(variant));
    assert.equal(parsed?.product_line, 'ALBALATEX DESIGN MATE INTERIOR');
    assert.equal(parsed?.base_letter, 'P');
    assert.equal(parsed?.size_label, '3,6 LTS');
    assert.equal(parsed?.confidence, 'high');
  });
});
