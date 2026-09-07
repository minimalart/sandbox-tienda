import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAILURE_COOLDOWN_DAYS,
  FAILURE_STRIKES,
  MAX_TRACKED_FAILURES,
  countSkippedByFailure,
  mergeImageFailures,
  shouldSkipImageFetch,
  type ImageFailures,
} from './image-failures.ts';

const NOW = new Date('2026-08-25T12:00:00.000Z');
const daysAgo = (n: number): string =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const failing = (count: number, days = 0) => ({ count, last_failed_at: daysAgo(days) });

describe('shouldSkipImageFetch', () => {
  it('un artículo sin historial nunca se saltea', () => {
    assert.equal(shouldSkipImageFetch(undefined, '113', NOW), false);
    assert.equal(shouldSkipImageFetch({}, '113', NOW), false);
  });

  /**
   * El punto del diseño: un 500 también es lo que devuelve un ERP caído, así que
   * con menos de tres corridas fallidas se sigue intentando. Si no, una caída de
   * diez minutos dejaría medio catálogo en la lista negra por una semana.
   */
  it('con menos strikes que el umbral se sigue intentando', () => {
    for (let n = 1; n < FAILURE_STRIKES; n += 1) {
      assert.equal(shouldSkipImageFetch({ '113': failing(n) }, '113', NOW), false, `count=${n}`);
    }
  });

  it('con los strikes cumplidos y dentro del cooldown se saltea', () => {
    assert.equal(shouldSkipImageFetch({ '113': failing(FAILURE_STRIKES) }, '113', NOW), true);
  });

  /** Vencido el cooldown se reintenta: al artículo pueden haberle cargado la foto. */
  it('pasado el cooldown vuelve a intentarse', () => {
    const viejo = { '113': failing(99, FAILURE_COOLDOWN_DAYS + 1) };
    assert.equal(shouldSkipImageFetch(viejo, '113', NOW), false);
  });

  it('una fecha corrupta no saltea nada', () => {
    const roto: ImageFailures = { '113': { count: 99, last_failed_at: 'cualquier cosa' } };
    assert.equal(shouldSkipImageFetch(roto, '113', NOW), false);
  });
});

describe('mergeImageFailures', () => {
  it('lo que falla suma un strike y renueva la fecha', () => {
    const out = mergeImageFailures({ '113': failing(1, 2) }, { failed: ['113'], imported: [] }, NOW);
    assert.equal(out['113']?.count, 2);
    assert.equal(out['113']?.last_failed_at, NOW.toISOString());
  });

  it('un código nuevo entra con un strike', () => {
    const out = mergeImageFailures({}, { failed: ['172'], imported: [] }, NOW);
    assert.deepEqual(out, { '172': { count: 1, last_failed_at: NOW.toISOString() } });
  });

  /**
   * Se borra en vez de dejarlo en cero: si el artículo vuelve a romperse alguna
   * vez, tiene que empezar de nuevo y no arrastrar strikes de hace meses.
   */
  it('lo que importa bien se borra del historial', () => {
    const out = mergeImageFailures(
      { '113': failing(FAILURE_STRIKES), '172': failing(1) },
      { failed: [], imported: ['113'] },
      NOW
    );
    assert.deepEqual(Object.keys(out), ['172']);
  });

  it('lo vencido se poda', () => {
    const out = mergeImageFailures(
      { viejo: failing(9, FAILURE_COOLDOWN_DAYS + 1), nuevo: failing(1, 1) },
      { failed: [], imported: [] },
      NOW
    );
    assert.deepEqual(Object.keys(out), ['nuevo']);
  });

  it('respeta el tope y conserva los más recientes', () => {
    const existing: ImageFailures = {};
    for (let i = 0; i < MAX_TRACKED_FAILURES + 10; i += 1) {
      // Los primeros son los más viejos; todos dentro del cooldown para que el
      // recorte sea lo único que los saque.
      existing[`c${i}`] = failing(1, (i % 5) + 1);
    }
    const out = mergeImageFailures(existing, { failed: [], imported: [] }, NOW);
    assert.equal(Object.keys(out).length, MAX_TRACKED_FAILURES);
  });

  it('ignora códigos vacíos', () => {
    const out = mergeImageFailures({}, { failed: ['', '113'], imported: [] }, NOW);
    assert.deepEqual(Object.keys(out), ['113']);
  });
});

/**
 * El caso de desdeelsur, de punta a punta: el mismo bloque de artículos falla
 * corrida tras corrida. A la tercera queda en cooldown y la fase puede seguir
 * con el resto del catálogo, que es lo que hoy no pasa nunca.
 */
describe('convergencia con un bloque de artículos siempre roto', () => {
  const rotos = ['113', '114', '172', '173'];

  it('a la tercera corrida deja de intentarlos', () => {
    let failures: ImageFailures = {};
    for (let run = 1; run <= FAILURE_STRIKES; run += 1) {
      const now = new Date(NOW.getTime() + run * 15 * 60 * 1000);
      const pendientes = rotos.filter((c) => !shouldSkipImageFetch(failures, c, now));
      assert.equal(pendientes.length, rotos.length, `corrida ${run} todavía los intenta`);
      failures = mergeImageFailures(failures, { failed: pendientes, imported: [] }, now);
    }
    const despues = new Date(NOW.getTime() + (FAILURE_STRIKES + 1) * 15 * 60 * 1000);
    assert.equal(countSkippedByFailure(failures, despues), rotos.length);
    for (const code of rotos) {
      assert.equal(shouldSkipImageFetch(failures, code, despues), true, code);
    }
  });
});
