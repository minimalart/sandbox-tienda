import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { imageFilename, planProductImages, type ProductImageState } from './plan-product-images.ts';
import { FAILURE_STRIKES, type ImageFailures } from './image-failures.ts';

const state = (overrides: Partial<ProductImageState> = {}): ProductImageState => ({
  code: '010/50',
  product_id: 'prod_1',
  has_thumbnail: false,
  has_images: false,
  ...overrides,
});

describe('planProductImages', () => {
  it('pide imagen para los productos que no tienen ninguna', () => {
    const plan = planProductImages([state()]);
    assert.deepEqual(plan.fetches, [{ code: '010/50', product_id: 'prod_1' }]);
    assert.deepEqual(plan.skipped, {});
  });

  it('nunca pisa un producto que ya tiene thumbnail', () => {
    const plan = planProductImages([state({ has_thumbnail: true })]);
    assert.equal(plan.fetches.length, 0);
    assert.equal(plan.skipped.already_has_image, 1);
  });

  it('nunca pisa un producto que tiene imágenes sin thumbnail', () => {
    const plan = planProductImages([state({ has_images: true })]);
    assert.equal(plan.fetches.length, 0);
    assert.equal(plan.skipped.already_has_image, 1);
  });

  it('baja UNA sola imagen por producto aunque tenga varias variantes', () => {
    const plan = planProductImages([
      state({ code: '010/50' }),
      state({ code: '010/100' }),
      state({ code: '020/50', product_id: 'prod_2' }),
    ]);
    assert.deepEqual(
      plan.fetches.map((fetch) => fetch.product_id),
      ['prod_1', 'prod_2']
    );
    assert.equal(plan.skipped.duplicate_product, 1);
  });

  it('saltea las filas sin producto', () => {
    const plan = planProductImages([state({ product_id: '' })]);
    assert.equal(plan.fetches.length, 0);
    assert.equal(plan.skipped.no_product, 1);
  });
});

describe('imageFilename', () => {
  it('saca la barra del código (en S3 crearía un prefijo fantasma)', () => {
    const name = imageFilename('010/50', 'jpg');
    assert.equal(name.includes('010/50'), false);
    assert.equal(name.startsWith('erp/010-50-'), true);
    assert.equal(name.endsWith('.jpg'), true);
  });

  it('es determinístico: el mismo código cae siempre en la misma clave', () => {
    assert.equal(imageFilename('010/50', 'jpg'), imageFilename('010/50', 'jpg'));
  });

  it('no colisiona entre códigos que slugifican igual', () => {
    assert.notEqual(imageFilename('010/50', 'jpg'), imageFilename('010-50', 'jpg'));
  });

  it('sobrevive a un código sin caracteres usables', () => {
    assert.equal(imageFilename('///', 'png').startsWith('erp/articulo-'), true);
  });
});

/**
 * El bloqueo real: en desdeelsur el mismo puñado de artículos daba HTTP 500 y la
 * fase moría antes de llegar a los otros ~900. Con el historial, esos códigos
 * salen del plan y la cola avanza.
 */
describe('planProductImages con artículos que vienen fallando', () => {
  const NOW = new Date('2026-08-25T12:00:00.000Z');
  const row = (code: string, product_id: string): ProductImageState => ({
    code,
    product_id,
    has_thumbnail: false,
    has_images: false,
  });
  const failures: ImageFailures = {
    '113': { count: FAILURE_STRIKES, last_failed_at: NOW.toISOString() },
  };

  it('sin la lista se pide todo, como antes', () => {
    const plan = planProductImages([row('113', 'prod_1'), row('999', 'prod_2')]);
    assert.deepEqual(
      plan.fetches.map((f) => f.code),
      ['113', '999']
    );
  });

  it('con la lista saltea el roto y sigue con el resto', () => {
    const plan = planProductImages([row('113', 'prod_1'), row('999', 'prod_2')], {
      failures,
      now: NOW,
    });
    assert.deepEqual(
      plan.fetches.map((f) => f.code),
      ['999']
    );
    assert.equal(plan.skipped.recently_failed, 1);
  });

  /**
   * El código en cooldown no puede quemar el cupo del producto: si otra variante
   * del MISMO producto se puede pedir, se pide.
   */
  it('una variante hermana pedible salva al producto', () => {
    const plan = planProductImages([row('113', 'prod_1'), row('114', 'prod_1')], {
      failures,
      now: NOW,
    });
    assert.deepEqual(
      plan.fetches.map((f) => f.code),
      ['114']
    );
  });
});
