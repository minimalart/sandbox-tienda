import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  overrideCodesOf,
  productLinesOf,
  selectBasesForColor,
} from './select-bases-for-color.ts';
import type { TintingBaseRow, TintingFormulaRow } from '../service.ts';

const formula = (over: Partial<TintingFormulaRow> = {}): TintingFormulaRow => ({
  id: 'erptfor_1',
  color_code: '51YY 61/792',
  collection: 'ALBAHYO',
  product_line: 'ALBACRYL LATEX INTERIOR ACRILICO MATE',
  base_letter: 'F',
  zeus_formula_code: '00NN 16/000',
  base_article_code: null,
  active: true,
  ...over,
});

const base = (over: Partial<TintingBaseRow> = {}): TintingBaseRow => ({
  id: 'erptbase_1',
  article_code: '113',
  base_letter: 'F',
  product_line: 'ALBACRYL LATEX INTERIOR ACRILICO MATE',
  collection: 'ALBAHYO',
  size_label: '3,6 LTS',
  size_liters: 3.6,
  source: 'parsed',
  confirmed: true,
  active: true,
  ...over,
});

describe('selectBasesForColor', () => {
  it('sin fórmulas no devuelve bases', () => {
    assert.deepEqual(
      selectBasesForColor({ formulas: [], basesByLine: [base()] }),
      []
    );
  });

  it('devuelve las bases cuya línea+letra tiene fórmula', () => {
    const result = selectBasesForColor({
      formulas: [formula()],
      basesByLine: [
        base({ article_code: '113', size_liters: 3.6 }),
        base({ article_code: '114', size_liters: 20, size_label: '20 LTS' }),
      ],
    });
    assert.deepEqual(
      result.map((r) => r.base.article_code),
      ['113', '114']
    );
    assert.equal(
      result.every((r) => !r.via_override),
      true
    );
  });

  it('descarta la MISMA línea con otra letra de base', () => {
    // La query trae todas las bases de la línea; la letra la filtra este cruce.
    // Sin esto se ofrecería una base P para un color que sólo tiene fórmula F.
    const result = selectBasesForColor({
      formulas: [formula({ base_letter: 'F' })],
      basesByLine: [base({ base_letter: 'F' }), base({ article_code: '210', base_letter: 'P' })],
    });
    assert.deepEqual(
      result.map((r) => r.base.article_code),
      ['113']
    );
  });

  it('trata base_letter nula como su propia clave (líneas de base única)', () => {
    const line = 'ALBA EFECTOS ESPECIALES DESIGN MARMOL';
    const result = selectBasesForColor({
      formulas: [formula({ product_line: line, base_letter: null })],
      basesByLine: [
        base({ article_code: '900', product_line: line, base_letter: null }),
        base({ article_code: '901', product_line: line, base_letter: 'F' }),
      ],
    });
    assert.deepEqual(
      result.map((r) => r.base.article_code),
      ['900']
    );
  });

  it('incluye la base del override aunque su línea+letra no tenga fórmula', () => {
    // Es el caso que `resolveTintingSelection` sí resuelve por precedencia: sin
    // esto el PDP entona un artículo que la página de colores no lista.
    const result = selectBasesForColor({
      formulas: [formula({ base_letter: 'MF', base_article_code: '777' })],
      basesByLine: [],
      basesByOverride: [base({ article_code: '777', base_letter: 'T' })],
    });
    assert.deepEqual(
      result.map((r) => [r.base.article_code, r.via_override]),
      [['777', true]]
    );
  });

  it('no duplica una base que entra por los dos caminos', () => {
    const result = selectBasesForColor({
      formulas: [formula({ base_article_code: '113' })],
      basesByLine: [base({ article_code: '113' })],
      basesByOverride: [base({ article_code: '113' })],
    });
    assert.equal(result.length, 1);
    assert.equal(result[0]!.via_override, true);
  });

  it('ordena por línea, después por litros, y deja los sin litros al final', () => {
    const otherLine = 'AAA PRIMERA LINEA';
    const result = selectBasesForColor({
      formulas: [formula(), formula({ product_line: otherLine })],
      basesByLine: [
        base({ article_code: 'sin-litros', size_liters: null, size_label: null }),
        base({ article_code: 'veinte', size_liters: 20 }),
        base({ article_code: 'uno', size_liters: 1 }),
        base({ article_code: 'otra-linea', product_line: otherLine, size_liters: 4 }),
      ],
    });
    assert.deepEqual(
      result.map((r) => r.base.article_code),
      ['otra-linea', 'uno', 'veinte', 'sin-litros']
    );
  });
});

describe('overrideCodesOf / productLinesOf', () => {
  it('deduplica y descarta los overrides vacíos', () => {
    const formulas = [
      formula({ base_article_code: ' 113 ' }),
      formula({ base_article_code: '113' }),
      formula({ base_article_code: '   ' }),
      formula({ base_article_code: null }),
    ];
    assert.deepEqual(overrideCodesOf(formulas), ['113']);
  });

  it('deduplica las líneas de producto', () => {
    const formulas = [formula(), formula({ base_letter: 'P' }), formula({ product_line: 'OTRA' })];
    assert.deepEqual(productLinesOf(formulas), [
      'ALBACRYL LATEX INTERIOR ACRILICO MATE',
      'OTRA',
    ]);
  });
});
