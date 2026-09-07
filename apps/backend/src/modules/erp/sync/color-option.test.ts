import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractColorLabel,
  isColorOptionTitle,
  planColorOptions,
  type ColorProductState,
} from './color-option.ts';

describe('extractColorLabel — títulos reales del catálogo', () => {
  it('saca el color de los lasures de madera', () => {
    assert.equal(extractColorLabel('Lasur roble claro x1 L'), 'Roble claro');
    assert.equal(extractColorLabel('Lasur roble oscuro x20 L'), 'Roble oscuro');
    assert.equal(extractColorLabel('Lasur caoba x1 L'), 'Caoba');
    assert.equal(extractColorLabel('Lasur cedro x20 L'), 'Cedro');
    assert.equal(extractColorLabel('Lasur natural x20 L'), 'Natural');
    assert.equal(extractColorLabel('Lasur cristal x1 L'), 'Cristal');
  });

  it('saca el color de esmaltes y aerosoles', () => {
    assert.equal(extractColorLabel('Dr. Ox. esmalte satinado negro x1 L'), 'Negro');
    assert.equal(extractColorLabel('Toke aerosol blanco satinado 283 gr'), 'Blanco');
    assert.equal(extractColorLabel('Toke aerosol gris oscuro 283 gr'), 'Gris oscuro');
    assert.equal(extractColorLabel('Vitelast cobre x250 cc'), 'Cobre');
    assert.equal(extractColorLabel('Vitelast 2 en 1 plata x375 cc'), 'Plata');
  });

  it('el color es el del final, no la técnica del principio', () => {
    // Medido contra el catálogo real: buscando de izquierda a derecha, estos daban
    // `Tiza` (la técnica, chalk paint) en 102 artículos en lugar del color.
    assert.equal(extractColorLabel('Pintura a la tiza 100 negro x200 cc'), 'Negro');
    assert.equal(extractColorLabel('Pintura a la tiza 030 cobre x200 cc'), 'Cobre');
    assert.equal(extractColorLabel('Acrílico G2 050 blanco perlado x50 cc'), 'Blanco');
    assert.equal(extractColorLabel('Pintura p/pisos al agua rojo colonial x4 L'), 'Rojo');
  });

  it('sin color conocido al final, prefiere null antes que la técnica', () => {
    // "oro" no está en el vocabulario: mejor sin etiqueta que etiquetado "Tiza".
    assert.equal(extractColorLabel('Pintura a la tiza 040 oro x200 cc'), null);
  });

  it('"tiza" SÍ es color cuando no viene de "a la tiza"', () => {
    assert.equal(extractColorLabel('Esmalte tiza x1 L'), 'Tiza');
  });

  it('prefiere la frase más larga: "roble claro" gana sobre "roble"', () => {
    assert.equal(extractColorLabel('Lasur roble claro x1 L'), 'Roble claro');
    assert.equal(extractColorLabel('Esmalte verde oscuro x1 L'), 'Verde oscuro');
    assert.equal(extractColorLabel('Esmalte azul marino x1 L'), 'Azul marino');
    // Sin el modificador, el color base.
    assert.equal(extractColorLabel('Lasur roble x1 L'), 'Roble');
    assert.equal(extractColorLabel('Esmalte verde x1 L'), 'Verde');
  });

  it('matchea sin tildes ni caso, como llega del ERP', () => {
    assert.equal(extractColorLabel('LASUR ROBLE CLARO X 1 LT'), 'Roble claro');
    assert.equal(extractColorLabel('esmalte ébano'), 'Ébano');
  });

  it('la etiqueta sale con la tilde del vocabulario aunque el ERP no la mande', () => {
    // El valor va a la opción de variante y se muestra en la card, así que la
    // forma canónica es la bien escrita.
    assert.equal(extractColorLabel('ESMALTE SINTETICO MARRON X 1 LT'), 'Marrón');
    assert.equal(extractColorLabel('ESMALTE SALMON X 1 LT'), 'Salmón');
    assert.equal(extractColorLabel('LASUR CIPRES X 1 LT'), 'Ciprés');
    assert.equal(extractColorLabel('ESMALTE VERDE INGLES X 1 LT'), 'Verde inglés');
    assert.equal(extractColorLabel('LASUR PINO OREGON X 1 LT'), 'Pino oregón');
    assert.equal(extractColorLabel('LASUR PETIRIBI X 1 LT'), 'Petiribí');
  });

  it('devuelve null cuando el título no tiene ningún color del vocabulario', () => {
    assert.equal(extractColorLabel('Barniz marino x0,25 L'), null);
    assert.equal(extractColorLabel('Masilla al agua x250 gr'), null);
    assert.equal(extractColorLabel('Pincel plano n 10'), null);
    assert.equal(extractColorLabel('Removedor de pinturas en gel x5 Kg'), null);
    assert.equal(extractColorLabel(''), null);
    assert.equal(extractColorLabel(null), null);
  });

  it('no inventa: una palabra fuera del vocabulario no es color', () => {
    // "satinado" y "metálico" son acabados, no colores; sin entrada no matchean.
    assert.equal(extractColorLabel('Esmalte satinado x1 L'), null);
    assert.equal(extractColorLabel('Marble color Base T mediano x25 Kg'), null);
  });

  it('respeta un vocabulario propio', () => {
    assert.equal(extractColorLabel('Esmalte coral x1 L'), null);
    assert.equal(extractColorLabel('Esmalte coral x1 L', ['coral']), 'Coral');
  });
});

describe('planColorOptions — corrección de la etiqueta ya escrita', () => {
  const state = (over: Partial<ColorProductState> = {}): ColorProductState => ({
    product_id: 'prod_1',
    option_titles: ['Formato', 'Color'],
    color_option_values: [{ option_value_id: 'optval_color', value: 'Marron' }],
    variants: [{ variant_id: 'variant_1', color: 'Marrón', options: { Formato: '1 lt', Color: 'Marron' } }],
    ...over,
  });

  it('corrige el mismo color escrito sin tilde, in situ', () => {
    // El id del valor no cambia, así que el link con la variante no se toca.
    const plan = planColorOptions([state()]);
    assert.deepEqual(plan.creates, []);
    assert.deepEqual(plan.renames, [
      { option_value_id: 'optval_color', from: 'Marron', to: 'Marrón', product_id: 'prod_1' },
    ]);
  });

  it('no toca una etiqueta que ya está bien', () => {
    const plan = planColorOptions([
      state({
        color_option_values: [{ option_value_id: 'optval_color', value: 'Marrón' }],
      }),
    ]);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.skipped.ya_tiene_color, 1);
  });

  it('no pisa una etiqueta que dice OTRO color', () => {
    // Puede haberla puesto alguien a mano: misma protección que con las
    // presentaciones.
    const plan = planColorOptions([
      state({
        color_option_values: [{ option_value_id: 'optval_color', value: 'Verde' }],
      }),
    ]);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.skipped.ya_tiene_color, 1);
  });

  it('sin color detectado en el título no hay nada que corregir', () => {
    const plan = planColorOptions([
      state({ variants: [{ variant_id: 'variant_1', color: null, options: {} }] }),
    ]);
    assert.deepEqual(plan.renames, []);
    assert.equal(plan.skipped.ya_tiene_color, 1);
  });
});

describe('isColorOptionTitle', () => {
  it('reconoce las options que el storefront pinta como color', () => {
    for (const title of ['Color', 'color', 'Colour', 'Tono', 'Tono de madera']) {
      assert.equal(isColorOptionTitle(title), true, title);
    }
  });

  it('no confunde Formato ni Presentación', () => {
    for (const title of ['Formato', 'Presentación', 'Talle', 'Medida', null]) {
      assert.equal(isColorOptionTitle(title), false, String(title));
    }
  });
});

describe('planColorOptions', () => {
  const state = (over: Partial<ColorProductState> = {}): ColorProductState => ({
    product_id: 'prod_1',
    option_titles: ['Formato'],
    variants: [{ variant_id: 'variant_1', color: 'Roble claro', options: { Formato: '1 L' } }],
    ...over,
  });

  it('agrega la opción cuando el título trae color y el producto no la tiene', () => {
    const plan = planColorOptions([state()]);
    assert.deepEqual(plan.creates, [
      {
        product_id: 'prod_1',
        variant_id: 'variant_1',
        color: 'Roble claro',
        // Las options actuales viajan en el plan: el link de la variante tiene que
        // re-mandarlas junto con `Color` o el módulo de producto lo rechaza.
        options: { Formato: '1 L' },
      },
    ]);
  });

  it('no toca un producto que YA tiene opción de color', () => {
    // Es el caso de los Xylasol cargados a mano el 28/7: se respeta lo que está.
    const plan = planColorOptions([state({ option_titles: ['Formato', 'Color'] })]);
    assert.deepEqual(plan.creates, []);
    assert.equal(plan.skipped.ya_tiene_color, 1);
  });

  it('no hace nada sin color en el título', () => {
    const plan = planColorOptions([state({ variants: [{ variant_id: 'variant_1', color: null, options: { Formato: '1 L' } }] })]);
    assert.deepEqual(plan.creates, []);
    assert.equal(plan.skipped.sin_color_en_el_titulo, 1);
  });

  it('no toca productos con varias variantes: el color puede ser por variante', () => {
    const plan = planColorOptions([
      state({
        variants: [
          { variant_id: 'variant_1', color: 'Roble claro', options: { Formato: '1 L' } },
          { variant_id: 'variant_2', color: 'Cedro', options: { Formato: '4 L' } },
        ],
      }),
    ]);
    assert.deepEqual(plan.creates, []);
    assert.equal(plan.skipped.multiples_variantes, 1);
  });

  it('es idempotente: después de crearla, la corrida siguiente la saltea', () => {
    const first = planColorOptions([state()]);
    assert.equal(first.creates.length, 1);
    const second = planColorOptions([state({ option_titles: ['Formato', 'Color'] })]);
    assert.deepEqual(second.creates, []);
  });
});
