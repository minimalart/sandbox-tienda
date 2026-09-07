import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTintingQuote } from './normalize-quote.ts';
import { normalizeFormulaCode, isFormulaCodePresent } from './formula-code.ts';

/**
 * Números REALES medidos contra la cuenta DESDE EL SUR SAS (2026-07-29):
 * fórmula `00NN 16/000` (color COSMOS) sobre la base `113` (ALBACRYL BASE F
 * 3,6 L), cuyo `precio1` de catálogo es 40585.52.
 */
const COSMOS = { total: 66352.822, tax_rate: 21 };
const BASE_113_PRICE = 40585.52;
const roundTwo = (value: number): number => Math.round(value * 100) / 100;

describe('normalizeFormulaCode', () => {
  it('saca los espacios: Gestión muestra "00NN 16/000", la API busca "00NN16/000"', () => {
    assert.equal(normalizeFormulaCode('00NN 16/000'), '00NN16/000');
    // Los espacios del borde tampoco perdonan (medido: devuelven 409).
    assert.equal(normalizeFormulaCode(' 00NN16/000 '), '00NN16/000');
    assert.equal(normalizeFormulaCode('00NN\t16/000'), '00NN16/000');
  });

  it('no toca el case (la API es case-insensitive, medido)', () => {
    assert.equal(normalizeFormulaCode('00nn16/000'), '00nn16/000');
  });

  it('isFormulaCodePresent ignora los códigos que son sólo espacios', () => {
    assert.equal(isFormulaCodePresent('00NN 16/000'), true);
    assert.equal(isFormulaCodePresent('   '), false);
    assert.equal(isFormulaCodePresent(null), false);
  });
});

describe('normalizeTintingQuote', () => {
  it('divide el total por la cantidad: `total` es de la LÍNEA, no unitario', () => {
    const one = normalizeTintingQuote({ raw: COSMOS, quantity: 1 });
    assert.equal(one?.unit_price, 66352.82);
    assert.equal(one?.line_total, 66352.82);

    // Medido: cantidad=2 devuelve 132705.645, o sea el doble exacto.
    const two = normalizeTintingQuote({ raw: { total: 132705.645, tax_rate: 21 }, quantity: 2 });
    assert.equal(two?.unit_price, 66352.82);
    assert.equal(two?.line_total, 132705.64);
  });

  /**
   * REGRESIÓN (reportado en producción): el total no se movía al subir la
   * cantidad y, peor, agregar 2 envases los cobraba al precio de 1.
   *
   * El quote service le pide a Zeus SIEMPRE `cantidad: 1` para que la caché no
   * dependa de la cantidad, y antes pasaba la cantidad pedida como si el `total`
   * correspondiera a ella: `unit_price = total / quantity` dividía el precio de un
   * envase entre N, y `line_total = unit_price * N` volvía siempre al mismo número.
   */
  it('con quoted_quantity=1 multiplica en vez de dividir', () => {
    const quote = normalizeTintingQuote({ raw: COSMOS, quantity: 2, quoted_quantity: 1 });
    assert.equal(quote?.unit_price, 66352.82);
    assert.equal(quote?.line_total, 132705.64);

    // Y el precio unitario NO cambia con la cantidad (era el bug: se hundía).
    for (const quantity of [1, 2, 3, 6, 12]) {
      const q = normalizeTintingQuote({ raw: COSMOS, quantity, quoted_quantity: 1 });
      assert.equal(q?.unit_price, 66352.82);
      assert.equal(q?.line_total, roundTwo(66352.82 * quantity));
    }
  });

  it('quoted_quantity default = quantity (contrato del ERP: total de la línea)', () => {
    // Cuando el `total` YA corresponde a la cantidad, no hay que tocar nada.
    const quote = normalizeTintingQuote({ raw: { total: 132705.645, tax_rate: 21 }, quantity: 2 });
    assert.equal(quote?.unit_price, 66352.82);
    assert.equal(quote?.line_total, 132705.64);
  });

  it('calcula el sobreprecio del entonado contra el precio de catálogo de la base', () => {
    const quote = normalizeTintingQuote({
      raw: COSMOS,
      quantity: 1,
      base_unit_price: BASE_113_PRICE,
    });
    assert.equal(quote?.tint_surcharge, 25767.3);
    assert.equal(quote?.tax_rate, 21);
  });

  it('sin precio de base no inventa el desglose', () => {
    assert.equal(normalizeTintingQuote({ raw: COSMOS, quantity: 1 })?.tint_surcharge, null);
  });

  it('con includes_tax=false le suma la alícuota', () => {
    const quote = normalizeTintingQuote({
      raw: { total: 1000, tax_rate: 21 },
      quantity: 1,
      includes_tax: false,
    });
    assert.equal(quote?.unit_price, 1210);
  });

  it('no cotiza cuando el ERP devuelve total 0 (así responde una lista sin precio)', () => {
    // Medido: lista 0 y 5..9 devuelven `total: 0.0` con HTTP 200, no un error.
    assert.equal(normalizeTintingQuote({ raw: { total: 0, tax_rate: 21 }, quantity: 1 }), null);
    assert.equal(normalizeTintingQuote({ raw: { total: -5, tax_rate: 21 }, quantity: 1 }), null);
  });

  it('rechaza cantidades no enteras o menores a 1 (la API exige Integer)', () => {
    assert.equal(normalizeTintingQuote({ raw: COSMOS, quantity: 1.5 }), null);
    assert.equal(normalizeTintingQuote({ raw: COSMOS, quantity: 0 }), null);
    assert.equal(normalizeTintingQuote({ raw: COSMOS, quantity: -1 }), null);
  });

  it('tolera un poriva ausente o absurdo', () => {
    assert.equal(normalizeTintingQuote({ raw: { total: 100, tax_rate: null }, quantity: 1 })?.tax_rate, null);
    assert.equal(
      normalizeTintingQuote({ raw: { total: 100, tax_rate: Number.NaN }, quantity: 1 })?.tax_rate,
      null
    );
  });
});
