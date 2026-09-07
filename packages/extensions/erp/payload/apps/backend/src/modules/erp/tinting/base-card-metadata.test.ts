import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CARD_SWATCHES, buildBaseCardMetadata } from './base-card-metadata.ts';

const base = (article_code: string, product_line: string, base_letter: string | null) => ({
  article_code,
  product_line,
  base_letter,
});
const formula = (product_line: string, base_letter: string | null, color_code: string) => ({
  product_line,
  base_letter,
  collection: 'ALBAHYO',
  color_code,
});
const color = (code: string, hex: string | null) => ({ code, collection: 'ALBAHYO', hex });

describe('buildBaseCardMetadata', () => {
  it('sin fórmulas no hay card', () => {
    const out = buildBaseCardMetadata({
      bases: [base('113', 'ALBACRYL', 'F')],
      formulas: [],
      colors: [color('14RR 12/349', '#863B67')],
    });
    assert.equal(out.size, 0);
  });

  it('cuenta las fórmulas de su línea+letra y toma los hex', () => {
    const out = buildBaseCardMetadata({
      bases: [base('113', 'ALBACRYL', 'F')],
      formulas: [formula('ALBACRYL', 'F', 'C1'), formula('ALBACRYL', 'F', 'C2')],
      colors: [color('C1', '#111111'), color('C2', '#222222')],
    });
    assert.deepEqual(out.get('113'), { count: 2, swatches: ['#111111', '#222222'] });
  });

  /** La letra es parte de la clave: la F y la P de la misma línea son cartas distintas. */
  it('no mezcla letras de la misma línea', () => {
    const out = buildBaseCardMetadata({
      bases: [base('113', 'ALBACRYL', 'F'), base('114', 'ALBACRYL', 'P')],
      formulas: [
        formula('ALBACRYL', 'F', 'C1'),
        formula('ALBACRYL', 'P', 'C2'),
        formula('ALBACRYL', 'P', 'C3'),
      ],
      colors: [color('C1', '#111111'), color('C2', '#222222'), color('C3', '#333333')],
    });
    assert.equal(out.get('113')?.count, 1);
    assert.equal(out.get('114')?.count, 2);
  });

  it('la base de letra única (null) también entra', () => {
    const out = buildBaseCardMetadata({
      bases: [base('712', 'MARMOL', null)],
      formulas: [formula('MARMOL', null, 'C1')],
      colors: [color('C1', '#111111')],
    });
    assert.equal(out.get('712')?.count, 1);
  });

  it('no repite hex y corta en el tope de la tira', () => {
    const many = Array.from({ length: 20 }, (_, i) => formula('L', 'F', `C${i}`));
    const out = buildBaseCardMetadata({
      bases: [base('1', 'L', 'F')],
      formulas: many,
      // Todos los colores comparten dos hex: la tira tiene que quedar en dos.
      colors: many.map((f, i) => color(f.color_code, i % 2 ? '#AAAAAA' : '#BBBBBB')),
    });
    assert.equal(out.get('1')?.count, 20);
    assert.deepEqual(out.get('1')?.swatches, ['#BBBBBB', '#AAAAAA']);

    const distintos = buildBaseCardMetadata({
      bases: [base('1', 'L', 'F')],
      formulas: many,
      colors: many.map((f, i) => color(f.color_code, `#${String(i).padStart(6, '0')}`)),
    });
    assert.equal(distintos.get('1')?.swatches.length, MAX_CARD_SWATCHES);
  });

  it('un color sin hex no rompe ni ocupa lugar en la tira', () => {
    const out = buildBaseCardMetadata({
      bases: [base('1', 'L', 'F')],
      formulas: [formula('L', 'F', 'C1'), formula('L', 'F', 'C2')],
      colors: [color('C1', null), color('C2', '#222222')],
    });
    assert.deepEqual(out.get('1'), { count: 2, swatches: ['#222222'] });
  });

  /**
   * El caso de desdeelsur: las bases REVEAR F y P no tienen ni una fórmula —sólo
   * la T las tiene— así que no pueden mostrar conteo. Publicar "+0 colores" sería
   * peor que no mostrar nada.
   */
  it('la base cuya letra no tiene carta queda afuera aunque la línea sí tenga', () => {
    const out = buildBaseCardMetadata({
      bases: [base('RV52', 'REVEAR - MARBLE COLOR', 'F'), base('RV60', 'REVEAR - MARBLE COLOR', 'T')],
      formulas: [formula('REVEAR - MARBLE COLOR', 'T', 'C1')],
      colors: [color('C1', '#111111')],
    });
    assert.equal(out.has('RV52'), false);
    assert.equal(out.get('RV60')?.count, 1);
  });
});
