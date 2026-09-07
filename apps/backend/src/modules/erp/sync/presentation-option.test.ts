import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupRenamesByValue,
  isPlaceholderLabel,
  planPresentationOptions,
  type PresentationProductState,
} from './presentation-option.ts';

/** Producto de una variante y una opción, que es la forma del 99% del catálogo. */
const state = (over: Partial<PresentationProductState> = {}): PresentationProductState => ({
  product_id: 'prod_1',
  variants: [{ variant_id: 'variant_1', title: 'Único', presentation: '1 lt' }],
  option_values: [{ option_value_id: 'optval_1', value: 'Único' }],
  ...over,
});

describe('planPresentationOptions — casos reales de la tienda', () => {
  it('rellena el placeholder del import con la presentación normalizada', () => {
    // "Texturado cartucho negro x1 lt" tenía `Formato: Único`.
    const plan = planPresentationOptions([state()]);
    assert.deepEqual(plan.renames, [
      { option_value_id: 'optval_1', from: 'Único', to: '1 lt', product_id: 'prod_1' },
    ]);
    assert.deepEqual(plan.variant_titles, [
      { variant_id: 'variant_1', from: 'Único', to: '1 lt' },
    ]);
  });

  it('normaliza el tamaño crudo de las bases tintométricas', () => {
    // Las 117 bases tienen `Presentación: 3,6 LTS` y su título dice `x3,6 lt`.
    const plan = planPresentationOptions([
      state({
        variants: [{ variant_id: 'variant_1', title: '3,6 LTS', presentation: '3,6 lt' }],
        option_values: [{ option_value_id: 'optval_1', value: '3,6 LTS' }],
      }),
    ]);
    assert.equal(plan.renames[0]!.to, '3,6 lt');
    // El título de la variante es la MISMA medida escrita distinto, así que
    // acompaña: dejarlo en `3,6 LTS` mientras la opción dice `3,6 lt` se ve en el
    // carrito y en el PDP.
    assert.deepEqual(plan.variant_titles, [
      { variant_id: 'variant_1', from: '3,6 LTS', to: '3,6 lt' },
    ]);
  });

  it('corrige la etiqueta que dejó la versión anterior de R25 (18 lt → 20 lt)', () => {
    // Los SKU 745, 748, 767, 770 y 993 de desdeelsur: el título ya se reescribió
    // a `x20 lt` cuando DESDEELSUR-23 declaró que los 17,4 son el balde de 20,
    // pero la opción y el título de la variante se quedaron en el `18 lt` que
    // había escrito el `Math.ceil` anterior. Sin reconocerlo como la MISMA
    // medida quedaba clasificado como etiqueta manual y no se corregía nunca.
    const plan = planPresentationOptions([
      state({
        variants: [{ variant_id: 'variant_1', title: '18 lt', presentation: '20 lt' }],
        option_values: [{ option_value_id: 'optval_1', value: '18 lt' }],
      }),
    ]);
    assert.deepEqual(plan.renames, [
      { option_value_id: 'optval_1', from: '18 lt', to: '20 lt', product_id: 'prod_1' },
    ]);
    assert.deepEqual(plan.variant_titles, [
      { variant_id: 'variant_1', from: '18 lt', to: '20 lt' },
    ]);
  });

  it('corrige la etiqueta que dejó la versión anterior de R25 (9 lt → 10 lt)', () => {
    // El par espejo del `18 lt`, ahora para DESDEELSUR-27: los 8,7 pasaron de
    // redondear a 9 a declararse el balde de 10, y el chip de las bases que ya
    // existían se quedó en el `9 lt` del `Math.ceil` anterior.
    const plan = planPresentationOptions([
      state({
        variants: [{ variant_id: 'variant_1', title: '9 lt', presentation: '10 lt' }],
        option_values: [{ option_value_id: 'optval_1', value: '9 lt' }],
      }),
    ]);
    assert.deepEqual(plan.renames, [
      { option_value_id: 'optval_1', from: '9 lt', to: '10 lt', product_id: 'prod_1' },
    ]);
    assert.deepEqual(plan.variant_titles, [
      { variant_id: 'variant_1', from: '9 lt', to: '10 lt' },
    ]);
  });

  it('NO toca un 9 lt que de verdad es un envase de 9 lt', () => {
    // Misma garantía que el 18: la etiqueta superada se reconoce por el DESTINO,
    // así que `9 lt` no se vuelve pisable en cualquier producto. Es lo que pide
    // explícito el ticket — no tocar lo que de verdad se vende en 9 litros.
    const plan = planPresentationOptions([
      state({
        variants: [{ variant_id: 'variant_1', title: '9 lt', presentation: '9 lt' }],
        option_values: [{ option_value_id: 'optval_1', value: '9 lt' }],
      }),
    ]);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.unchanged, 1);
  });

  it('NO toca un 18 lt que de verdad es un envase de 18 lt', () => {
    // El reconocimiento de la etiqueta superada mira el DESTINO: si el artículo
    // declara 18 lt, target y valor coinciden y no hay nada que renombrar. Lo
    // que no puede pasar es que `18 lt` se vuelva pisable en cualquier producto.
    const plan = planPresentationOptions([
      state({
        variants: [{ variant_id: 'variant_1', title: '18 lt', presentation: '18 lt' }],
        option_values: [{ option_value_id: 'optval_1', value: '18 lt' }],
      }),
    ]);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.unchanged, 1);
  });

  it('deja intacta una etiqueta puesta a mano', () => {
    const plan = planPresentationOptions([
      state({ option_values: [{ option_value_id: 'optval_1', value: 'Pack x6' }] }),
    ]);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.skipped.etiqueta_manual, 1);
  });

  it('no hace nada si ya está bien', () => {
    const plan = planPresentationOptions([
      state({ option_values: [{ option_value_id: 'optval_1', value: '1 lt' }] }),
    ]);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.unchanged, 1);
  });

  it('es idempotente: el resultado del primer pase no genera un segundo', () => {
    const first = planPresentationOptions([state()]);
    const applied = state({
      variants: [{ variant_id: 'variant_1', title: '1 lt', presentation: '1 lt' }],
      option_values: [{ option_value_id: 'optval_1', value: first.renames[0]!.to }],
    });
    const second = planPresentationOptions([applied]);
    assert.deepEqual(second.renames, []);
    assert.deepEqual(second.variant_titles, []);
    assert.equal(second.unchanged, 1);
  });
});

describe('planPresentationOptions — la opción de color no es una presentación', () => {
  it('renombra el formato aunque el producto tenga también opción de color', () => {
    // Caso REAL medido en prod: 1.512 productos quedaron con `Formato: 1 L`
    // mientras su título decía `x1 lt`, porque el guard contaba el valor de color
    // como una presentación más.
    const plan = planPresentationOptions([
      state({
        variants: [{ variant_id: 'variant_1', title: '1 L', presentation: '1 lt' }],
        option_values: [
          { option_value_id: 'optval_formato', value: '1 L', option_title: 'Formato' },
          { option_value_id: 'optval_color', value: 'Marrón', option_title: 'Color' },
        ],
      }),
    ]);
    assert.deepEqual(plan.renames, [
      { option_value_id: 'optval_formato', from: '1 L', to: '1 lt', product_id: 'prod_1' },
    ]);
    // El título de la variante acompaña: es la misma medida escrita distinto.
    assert.deepEqual(plan.variant_titles, [
      { variant_id: 'variant_1', from: '1 L', to: '1 lt' },
    ]);
  });

  it('sigue salteando el producto con presentaciones reales aunque tenga color', () => {
    const plan = planPresentationOptions([
      state({
        variants: [{ variant_id: 'variant_1', title: '1 lt', presentation: '1 lt' }],
        option_values: [
          { option_value_id: 'optval_1', value: '1 lt', option_title: 'Formato' },
          { option_value_id: 'optval_2', value: '4 lt', option_title: 'Formato' },
          { option_value_id: 'optval_color', value: 'Marrón', option_title: 'Color' },
        ],
      }),
    ]);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.skipped.multiples_presentaciones, 1);
  });
});

describe('planPresentationOptions — lo que NO toca', () => {
  it('un artículo sin presentación en el título (un pincel, una herramienta)', () => {
    const plan = planPresentationOptions([
      state({ variants: [{ variant_id: 'variant_1', title: 'Único', presentation: null }] }),
    ]);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.skipped.sin_presentacion, 1);
  });

  it('un producto con presentaciones reales (varias variantes)', () => {
    const plan = planPresentationOptions([
      state({
        variants: [
          { variant_id: 'variant_1', title: '1 lt', presentation: '1 lt' },
          { variant_id: 'variant_2', title: '4 lt', presentation: '4 lt' },
        ],
        option_values: [
          { option_value_id: 'optval_1', value: '1 lt' },
          { option_value_id: 'optval_2', value: '4 lt' },
        ],
      }),
    ]);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.skipped.multiples_presentaciones, 1);
  });

  it('un producto de una variante pero con la option compartida por dos valores', () => {
    // Renombrar un valor compartido le cambiaría la etiqueta a otra variante.
    const plan = planPresentationOptions([
      state({
        option_values: [
          { option_value_id: 'optval_1', value: 'Único' },
          { option_value_id: 'optval_2', value: 'Otro' },
        ],
      }),
    ]);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.skipped.multiples_presentaciones, 1);
  });
});

describe('isPlaceholderLabel', () => {
  it('reconoce los rellenos que el storefront esconde', () => {
    for (const value of ['Único', 'unico', 'UNICO', 'Default', 'default title', 'Estándar', 'N/A', '-', '—']) {
      assert.equal(isPlaceholderLabel(value), true, value);
    }
  });

  it('no confunde una presentación real con relleno', () => {
    for (const value of ['1 lt', '3,6 lt', '25 kg', '500 gr', '125 cc', 'Pack x6']) {
      assert.equal(isPlaceholderLabel(value), false, value);
    }
  });
});

describe('groupRenamesByValue', () => {
  it('agrupa por valor destino para una sola llamada por presentación', () => {
    const grouped = groupRenamesByValue([
      { option_value_id: 'a', from: 'Único', to: '1 lt', product_id: 'p1' },
      { option_value_id: 'b', from: 'Único', to: '4 lt', product_id: 'p2' },
      { option_value_id: 'c', from: 'Único', to: '1 lt', product_id: 'p3' },
    ]);
    assert.deepEqual(grouped, [
      { value: '1 lt', option_value_ids: ['a', 'c'] },
      { value: '4 lt', option_value_ids: ['b'] },
    ]);
  });
});

describe('planPresentationOptions — la medida vieja con la unidad equivocada (DESDEELSUR-34)', () => {
  it('pisa una medida cuya UNIDAD contradice al título', () => {
    // SKU 570: la card dice "Duralba frentes látex exterior vinílico blanco
    // x20 lt", `zeus_presentacion` dice `20 lt` y el chip dice `20 kg`. Antes
    // caía en `etiqueta_manual` y la contradicción quedaba protegida.
    const plan = planPresentationOptions([
      state({
        variants: [{ variant_id: 'variant_1', title: '20 kg', presentation: '20 lt' }],
        option_values: [{ option_value_id: 'optval_1', value: '20 kg' }],
      }),
    ]);
    assert.deepEqual(plan.renames, [
      { option_value_id: 'optval_1', from: '20 kg', to: '20 lt', product_id: 'prod_1' },
    ]);
    assert.deepEqual(plan.variant_titles, [
      { variant_id: 'variant_1', from: '20 kg', to: '20 lt' },
    ]);
  });

  it('respeta una CANTIDAD distinta: eso sí puede ser una corrección deliberada', () => {
    const plan = planPresentationOptions([
      state({
        variants: [{ variant_id: 'variant_1', title: '10 lt', presentation: '20 lt' }],
        option_values: [{ option_value_id: 'optval_1', value: '10 lt' }],
      }),
    ]);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.skipped.etiqueta_manual, 1);
  });

  it('sigue sin tocar una etiqueta que no es una medida', () => {
    const plan = planPresentationOptions([
      state({
        variants: [{ variant_id: 'variant_1', title: 'Pack x6', presentation: '20 lt' }],
        option_values: [{ option_value_id: 'optval_1', value: 'Pack x6' }],
      }),
    ]);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.skipped.etiqueta_manual, 1);
  });

  it('corrige el chip de las bases de 17,4 L una vez que tienen presentación', () => {
    // Las 19 bases con título `x20 lt` y chip `18 lt`. El bloqueo nunca fue la
    // política: era que sin `zeus_presentacion` no había `target` que comparar.
    const plan = planPresentationOptions([
      state({
        variants: [{ variant_id: 'variant_1', title: '18 lt', presentation: '20 lt' }],
        option_values: [
          { option_value_id: 'optval_1', value: '18 lt', option_title: 'Presentación' },
        ],
      }),
    ]);
    assert.equal(plan.renames[0]!.to, '20 lt');
    assert.deepEqual(plan.variant_titles, [
      { variant_id: 'variant_1', from: '18 lt', to: '20 lt' },
    ]);
  });
});
