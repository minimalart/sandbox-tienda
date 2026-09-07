import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeSeoScore } from './index';
import type { CrawledPage } from '../crawler/types';
import type { EngineFinding } from './types';

/** Sólo `length` importa para el score: se normaliza por cantidad de páginas. */
const pages = (n: number): CrawledPage[] => Array.from({ length: n }) as CrawledPage[];

const findings = (critical: number, warning = 0, info = 0): EngineFinding[] => [
  ...Array.from({ length: critical }, () => ({ severity: 'critical' })),
  ...Array.from({ length: warning }, () => ({ severity: 'warning' })),
  ...Array.from({ length: info }, () => ({ severity: 'info' })),
] as EngineFinding[];

describe('computeSeoScore', () => {
  it('sin hallazgos es 100', () => {
    assert.equal(computeSeoScore(pages(10), []), 100);
  });

  it('NO satura: los tres estados que antes daban 0 ahora se distinguen', () => {
    // Las tres auditorías reales de la misma tienda, en penalidad por página: 6,1 / 9,9
    // / 28,5. Con la rampa lineal recortada las tres publicaban 0.
    const a = computeSeoScore(pages(150), findings(5, 440, 12));
    const b = computeSeoScore(pages(57), findings(28, 202, 62));
    const c = computeSeoScore(pages(55), findings(275, 93, 27));

    assert.ok(a > b, `esperaba ${a} > ${b}`);
    assert.ok(b > c, `esperaba ${b} > ${c}`);
    assert.ok(a > 0 && b > 0, `ninguno de los dos primeros debería tocar el piso: ${a}, ${b}`);
  });

  it('es monótono decreciente en la penalidad por página', () => {
    const scores = [0, 1, 2, 5, 10, 20].map((crit) => computeSeoScore(pages(10), findings(crit)));
    for (let i = 1; i < scores.length; i++) {
      assert.ok((scores[i] as number) < (scores[i - 1] as number), `no decrece: ${scores.join(', ')}`);
    }
  });

  it('a la escala de la curva vale ~37 (100/e)', () => {
    // SCORE_SCALE = 5.6 penalidad/página. 56 críticos en 50 páginas = 5.6.
    assert.equal(computeSeoScore(pages(50), findings(56)), 37);
  });

  it('queda en el rango 0-100 con un sitio arrasado', () => {
    const score = computeSeoScore(pages(1), findings(1000));
    assert.ok(score >= 0 && score <= 100, `fuera de rango: ${score}`);
  });
});
