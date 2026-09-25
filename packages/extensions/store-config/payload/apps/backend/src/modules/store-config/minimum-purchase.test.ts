import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  minimumPurchaseFilter,
  missingForMinimum,
  pickEffectiveMinimumPurchase,
  type MinimumPurchaseRow,
} from './minimum-purchase.ts';

const AHORA = new Date('2026-09-22T12:00:00Z');

const fila = (over: Partial<MinimumPurchaseRow> = {}): MinimumPurchaseRow => ({
  amount: 160000,
  currency_code: 'ars',
  starts_at: '2026-08-20T00:00:00Z',
  ends_at: null,
  site_id: null,
  ...over,
});

describe('minimumPurchaseFilter', () => {
  /**
   * `{ site_id: [siteId, null] }` se emite como `site_id IN (…, NULL)` y en SQL eso
   * NO matchea un `site_id IS NULL`: la serie global desaparecía justo cuando la key
   * resolvía tienda, y el carrito quedaba sin mínimo con el mínimo cargado.
   */
  test('con tienda alcanza también la fila global, y por $or', () => {
    assert.deepEqual(minimumPurchaseFilter('site_1'), {
      $or: [{ site_id: 'site_1' }, { site_id: null }],
    });
  });

  test('sin tienda filtra a la GLOBAL, no a todas', () => {
    assert.deepEqual(minimumPurchaseFilter(null), { site_id: null });
  });
});

describe('pickEffectiveMinimumPurchase', () => {
  test('descarta la que todavía no arrancó', () => {
    const futura = fila({ amount: 999999, starts_at: '2026-12-01T00:00:00Z' });
    const vigente = fila();
    assert.equal(pickEffectiveMinimumPurchase([futura, vigente], null, AHORA)?.amount, 160000);
  });

  test('descarta la que ya venció', () => {
    const vencida = fila({ amount: 999999, ends_at: '2026-09-01T00:00:00Z' });
    const vigente = fila();
    assert.equal(pickEffectiveMinimumPurchase([vencida, vigente], null, AHORA)?.amount, 160000);
  });

  /**
   * Con las dos series mezcladas ganaría la más reciente, así que un cambio del
   * mínimo GLOBAL pisaría el propio de una tienda que lo definió antes: la tienda
   * cree que fijó su monto y opera con el de la instancia sin que nada avise.
   */
  test('la serie de la tienda le gana a la global aunque la global sea más nueva', () => {
    const global = fila({ amount: 500000, starts_at: '2026-09-20T00:00:00Z' });
    const propia = fila({ amount: 120000, site_id: 'site_1', starts_at: '2026-08-01T00:00:00Z' });
    assert.equal(pickEffectiveMinimumPurchase([global, propia], 'site_1', AHORA)?.amount, 120000);
  });

  test('la tienda sin serie propia hereda la global', () => {
    const global = fila({ amount: 500000 });
    assert.equal(pickEffectiveMinimumPurchase([global], 'site_1', AHORA)?.amount, 500000);
  });

  test('sin filas vigentes devuelve null', () => {
    assert.equal(pickEffectiveMinimumPurchase([fila({ starts_at: '2027-01-01T00:00:00Z' })], null, AHORA), null);
  });
});

describe('missingForMinimum', () => {
  test('por debajo del mínimo dice cuánto falta', () => {
    assert.deepEqual(missingForMinimum(fila(), 45000, 'ars'), { missing: 115000, amount: 160000 });
  });

  test('justo en el mínimo ya pasa', () => {
    assert.equal(missingForMinimum(fila(), 160000, 'ars'), null);
  });

  test('sin mínimo cargado no bloquea', () => {
    assert.equal(missingForMinimum(null, 10, 'ars'), null);
  });

  /**
   * Comparar montos de monedas distintas no significa nada, y voltear la venta por
   * un problema de configuración es peor que dejar pasar un pedido corto — que el
   * checkout del storefront vuelve a validar igual.
   */
  test('moneda distinta NO bloquea', () => {
    assert.equal(missingForMinimum(fila({ currency_code: 'usd' }), 10, 'ars'), null);
    // Y la mayúscula/minúscula no cuenta como moneda distinta.
    assert.ok(missingForMinimum(fila({ currency_code: 'ARS' }), 10, 'ars'));
  });

  test('un mínimo en cero o basura no bloquea', () => {
    assert.equal(missingForMinimum(fila({ amount: 0 }), 10, 'ars'), null);
    assert.equal(missingForMinimum(fila({ amount: Number.NaN }), 10, 'ars'), null);
  });
});
