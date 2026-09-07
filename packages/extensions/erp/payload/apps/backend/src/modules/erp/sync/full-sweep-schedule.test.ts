import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldFullSweep } from './full-sweep-schedule.ts';

/** 4 AM local del día indicado, que es la hora de barrido por default. */
const at = (day: number, hour = 4, minute = 0) => new Date(2026, 7, day, hour, minute, 0);

describe('shouldFullSweep — un barrido completo por día, no uno por tick', () => {
  it('sin marca previa y en la hora configurada → barre', () => {
    assert.equal(shouldFullSweep({ full_sweep_hour: 4, last_full_sweep_at: null }, at(18)), true);
  });

  it('fuera de la hora configurada → no barre', () => {
    assert.equal(shouldFullSweep({ full_sweep_hour: 4 }, at(18, 3, 45)), false);
    assert.equal(shouldFullSweep({ full_sweep_hour: 4 }, at(18, 5, 0)), false);
  });

  it('ya barrió hoy → los ticks siguientes de la MISMA hora no vuelven a barrer', () => {
    // El bug original: con cron cada 15 minutos, 4:00 / 4:15 / 4:30 / 4:45 daban
    // cuatro barridos completos. Solo el primero tiene que pasar.
    const settings = { full_sweep_hour: 4, last_full_sweep_at: at(18, 4, 0).toISOString() };
    assert.equal(shouldFullSweep(settings, at(18, 4, 15)), false);
    assert.equal(shouldFullSweep(settings, at(18, 4, 30)), false);
    assert.equal(shouldFullSweep(settings, at(18, 4, 45)), false);
  });

  it('la marca es de ayer → vuelve a barrer', () => {
    const settings = { full_sweep_hour: 4, last_full_sweep_at: at(17).toISOString() };
    assert.equal(shouldFullSweep(settings, at(18)), true);
  });

  it('la marca es del mismo día pero de otra hora → no vuelve a barrer', () => {
    // Un barrido MANUAL a las 3 AM consume el cupo del día. Es lo correcto (ya
    // barrió) pero es el borde que hay que dejar fijado en un test.
    const settings = { full_sweep_hour: 4, last_full_sweep_at: at(18, 3, 10).toISOString() };
    assert.equal(shouldFullSweep(settings, at(18)), false);
  });

  it('`full_sweep_hour: null` apaga el barrido en cualquier hora', () => {
    assert.equal(shouldFullSweep({ full_sweep_hour: null }, at(18)), false);
  });

  it('hora inválida o settings ausentes → no barre', () => {
    assert.equal(shouldFullSweep({ full_sweep_hour: 24 }, at(18, 0)), false);
    assert.equal(shouldFullSweep({ full_sweep_hour: -1 }, at(18, 0)), false);
    assert.equal(shouldFullSweep({ full_sweep_hour: 4.5 }, at(18)), false);
    assert.equal(shouldFullSweep(undefined, at(18)), false);
    assert.equal(shouldFullSweep(null, at(18)), false);
  });

  it('marca ilegible → barre (lado seguro: el sync es idempotente)', () => {
    assert.equal(shouldFullSweep({ full_sweep_hour: 4, last_full_sweep_at: 'no-fecha' }, at(18)), true);
  });

  it('cruce de año: 31/12 y 1/1 son días distintos', () => {
    const nyEve = new Date(2026, 11, 31, 4, 0, 0);
    const nyDay = new Date(2027, 0, 1, 4, 0, 0);
    const settings = { full_sweep_hour: 4, last_full_sweep_at: nyEve.toISOString() };
    assert.equal(shouldFullSweep(settings, nyEve), false);
    assert.equal(shouldFullSweep(settings, nyDay), true);
  });
});
