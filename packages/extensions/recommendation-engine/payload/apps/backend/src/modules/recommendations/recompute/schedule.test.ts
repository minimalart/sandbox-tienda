import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isDue } from './schedule';

const NOW = new Date('2026-07-24T12:00:00.000Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

describe('isDue', () => {
  it('encola el primer build cuando nunca corrió', () => {
    assert.equal(
      isDue({ kind: 'popular', cadence: 'daily', enabled: true, last_built_at: null }, NOW).due,
      true,
    );
  });

  it('nunca recalcula las relaciones manuales', () => {
    const verdict = isDue({ kind: 'manual', cadence: 'daily', enabled: true, last_built_at: null }, NOW);
    assert.equal(verdict.due, false);
    assert.match(verdict.reason ?? '', /manuales/);
  });

  it('respeta la cadencia manual', () => {
    assert.equal(
      isDue({ kind: 'popular', cadence: 'manual', enabled: true, last_built_at: null }, NOW).due,
      false,
    );
  });

  it('no encola estrategias deshabilitadas', () => {
    assert.equal(
      isDue({ kind: 'popular', cadence: 'daily', enabled: false, last_built_at: null }, NOW).due,
      false,
    );
  });

  it('cadencia horaria: encola pasada la hora', () => {
    assert.equal(
      isDue({ kind: 'trending', cadence: 'hourly', enabled: true, last_built_at: hoursAgo(2) }, NOW).due,
      true,
    );
    assert.equal(
      isDue({ kind: 'trending', cadence: 'hourly', enabled: true, last_built_at: hoursAgo(0.2) }, NOW).due,
      false,
    );
  });

  it('cadencia diaria: encola pasado el día', () => {
    assert.equal(
      isDue({ kind: 'popular', cadence: 'daily', enabled: true, last_built_at: hoursAgo(25) }, NOW).due,
      true,
    );
    assert.equal(
      isDue({ kind: 'popular', cadence: 'daily', enabled: true, last_built_at: hoursAgo(5) }, NOW).due,
      false,
    );
  });

  it('tolera el 10% para que un cron que dispara temprano no saltee la corrida', () => {
    // Un cron horario que dispara a los 59'50" tiene que encolar igual; si no, la
    // estrategia se recalcularía cada 2 horas en la práctica.
    assert.equal(
      isDue(
        { kind: 'trending', cadence: 'hourly', enabled: true, last_built_at: hoursAgo(0.95) },
        NOW,
      ).due,
      true,
    );
  });

  it('trata una fecha inválida como "nunca corrió"', () => {
    assert.equal(
      isDue(
        { kind: 'popular', cadence: 'daily', enabled: true, last_built_at: 'no-es-fecha' },
        NOW,
      ).due,
      true,
    );
  });

  it('no encola con una cadencia desconocida', () => {
    const verdict = isDue(
      { kind: 'popular', cadence: 'cada-luna-llena', enabled: true, last_built_at: null },
      NOW,
    );
    assert.equal(verdict.due, false);
    assert.match(verdict.reason ?? '', /desconocida/);
  });
});
