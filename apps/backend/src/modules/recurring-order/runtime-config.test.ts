import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRuntimeConfig, orderRowsByPrecedence } from './runtime-config.ts';
import { getRecurringOrderConfig } from './config.ts';

const ENV = getRecurringOrderConfig();

describe('mergeRuntimeConfig', () => {
  it('sin filas usa los defaults de env', () => {
    const config = mergeRuntimeConfig([], ENV);
    assert.equal(config.reminderHours, ENV.reminderHours);
    assert.equal(config.stockPolicy, 'skip_unavailable');
    assert.equal(config.priceChangePolicy, 'always_current');
    assert.equal(config.priceChangeThresholdPct, 20);
  });

  it('la fila del canal pisa a la global campo a campo', () => {
    const config = mergeRuntimeConfig(
      [
        { reminder_hours: 12, stock_policy: null },
        { reminder_hours: 48, stock_policy: 'fail_cycle', expiration_hours: 96 },
      ],
      ENV,
    );
    assert.equal(config.reminderHours, 12); // canal
    assert.equal(config.stockPolicy, 'fail_cycle'); // canal null → hereda global
    assert.equal(config.paymentExpirationHours, 96); // solo global
  });

  it('valores inválidos se ignoran (caen al siguiente nivel)', () => {
    const config = mergeRuntimeConfig(
      [{ reminder_hours: -5, price_change_policy: 'whatever' }],
      ENV,
    );
    assert.equal(config.reminderHours, ENV.reminderHours);
    assert.equal(config.priceChangePolicy, 'always_current');
  });

  it('warn_over_threshold con umbral propio', () => {
    const config = mergeRuntimeConfig(
      [{ price_change_policy: 'warn_over_threshold', price_change_threshold_pct: 10 }],
      ENV,
    );
    assert.equal(config.priceChangePolicy, 'warn_over_threshold');
    assert.equal(config.priceChangeThresholdPct, 10);
  });
});

/**
 * El bug B2B, escrito para que no vuelva.
 *
 * Una tienda con `b2b_enabled` tiene DOS sales channels y guarda su configuración
 * contra UNO. Buscando sólo por el canal del pedido, un ciclo del canal mayorista
 * caía a la global y la tienda operaba con las políticas de la instancia sin un
 * solo error. Vivió 77 commits después de que el plan lo diera por arreglado,
 * porque el seam estaba bien y el consumidor no lo usaba.
 *
 * Se testea `orderRowsByPrecedence` y no `resolveRuntimeConfig` porque la segunda
 * necesita un container de Medusa; la decisión que importa —qué fila gana— es pura.
 */
describe('orderRowsByPrecedence · el bug B2B', () => {
  const RETAIL = 'sc_retail';
  const MAYORISTA = 'sc_mayorista';
  const CANALES = [RETAIL, MAYORISTA];

  const fila = (id: string | null, marca: string) => ({
    sales_channel_id: id,
    max_attempts: 1,
    __marca: marca,
  });

  it('el canal mayorista hereda la config de su tienda, no la global', () => {
    // La config se guardó contra el canal retail; el ciclo corre en el mayorista.
    const rows = [fila(RETAIL, 'tienda'), fila(null, 'global')];
    const orden = orderRowsByPrecedence(rows, MAYORISTA, CANALES);

    assert.equal(
      orden[0]?.__marca,
      'tienda',
      'el canal mayorista cayó a la global: la tienda opera con las políticas de la instancia',
    );
    assert.equal(orden[1]?.__marca, 'global', 'la global tiene que quedar de respaldo');
  });

  it('la fila del canal exacto le gana a la de su hermano', () => {
    const rows = [fila(RETAIL, 'hermano'), fila(MAYORISTA, 'propia'), fila(null, 'global')];
    const orden = orderRowsByPrecedence(rows, MAYORISTA, CANALES);
    assert.deepEqual(orden.map((r) => r.__marca), ['propia', 'hermano', 'global']);
  });

  it('un canal de OTRA tienda no se hereda', () => {
    // Lo que hace que esto no sea "buscar por cualquier canal": el escalón del
    // medio son los hermanos de ESTA tienda, y la lista sale del seam.
    const rows = [fila('sc_de_otra_tienda', 'ajena'), fila(null, 'global')];
    const orden = orderRowsByPrecedence(rows, MAYORISTA, CANALES);
    assert.deepEqual(
      orden.map((r) => r.__marca),
      ['global'],
      'se coló la config de otra tienda',
    );
  });

  it('sin canal (proceso global) sólo aplica la global', () => {
    const rows = [fila(RETAIL, 'tienda'), fila(null, 'global')];
    assert.deepEqual(
      orderRowsByPrecedence(rows, null, []).map((r) => r.__marca),
      ['global'],
    );
  });
});
