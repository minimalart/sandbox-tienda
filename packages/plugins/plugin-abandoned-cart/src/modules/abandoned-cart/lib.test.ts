import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectionWindow,
  isContactable,
  isWithinDetectionWindow,
  nextEligibleAfter,
  shapeMetrics,
  type MetricsAggregateRow,
} from './lib';
import { getAbandonedCartConfig, nextStepFor, type AbandonedCartConfig } from './config';

/**
 * Estos tests fijan el contrato de la detección y de las métricas, que estuvieron
 * roturados en silencio: el panel mostraba todo en 0 porque la ventana temporal se
 * filtraba en memoria DESPUÉS de paginar, así que los carritos abiertos más viejos
 * de la tienda consumían la corrida entera y nunca se detectaba nada.
 */

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date('2026-08-03T12:00:00.000Z');

/** Config con los defaults reales (pasos 1h/24h/72h, ventana 14 días). */
const config = (): AbandonedCartConfig => getAbandonedCartConfig();

const hoursAgo = (h: number) => new Date(NOW.getTime() - h * HOUR_MS);

// ── Ventana de detección ─────────────────────────────────────────────────────

test('la ventana va del primer paso hasta la edad máxima', () => {
  const w = detectionWindow(NOW, config());

  assert.equal(w.idleBefore.toISOString(), hoursAgo(1).toISOString());
  assert.equal(w.oldestAllowed.toISOString(), hoursAgo(24 * 14).toISOString());
});

test('un carrito recién tocado NO entra: todavía no llegó al umbral de inactividad', () => {
  const w = detectionWindow(NOW, config());

  assert.equal(isWithinDetectionWindow(hoursAgo(0.5), w), false);
});

test('un carrito inactivo hace 2h entra en la ventana', () => {
  const w = detectionWindow(NOW, config());

  assert.equal(isWithinDetectionWindow(hoursAgo(2), w), true);
});

test('un carrito de 20 días NO entra: la ventana de recuperación ya cerró', () => {
  const w = detectionWindow(NOW, config());

  assert.equal(isWithinDetectionWindow(hoursAgo(24 * 20), w), false);
});

test('los bordes exactos de la ventana son inclusivos', () => {
  const w = detectionWindow(NOW, config());

  assert.equal(isWithinDetectionWindow(w.idleBefore, w), true);
  assert.equal(isWithinDetectionWindow(w.oldestAllowed, w), true);
});

test('sin última actividad, o con una fecha ilegible, el carrito no entra', () => {
  const w = detectionWindow(NOW, config());

  assert.equal(isWithinDetectionWindow(null, w), false);
  assert.equal(isWithinDetectionWindow(undefined, w), false);
  assert.equal(isWithinDetectionWindow('no-es-una-fecha', w), false);
});

test('una avalancha de carritos viejos no tapa a los que sí están en ventana', () => {
  // Reproduce el bug original: con el filtro en memoria, 200 carritos de 2 años
  // consumían el lote entero y el de 2h nunca se llegaba a evaluar. Al filtrar por
  // ventana, los viejos simplemente no forman parte del universo.
  const w = detectionWindow(NOW, config());
  const carts = [
    ...Array.from({ length: 200 }, () => hoursAgo(24 * 730)),
    hoursAgo(2),
  ];

  const inWindow = carts.filter((c) => isWithinDetectionWindow(c, w));

  assert.equal(inWindow.length, 1);
  assert.equal(inWindow[0].toISOString(), hoursAgo(2).toISOString());
});

// ── Contactabilidad ──────────────────────────────────────────────────────────

test('contactable con email, con teléfono, o con cualquiera de los dos', () => {
  assert.equal(isContactable({ email: 'a@b.com', phone: null }), true);
  assert.equal(isContactable({ email: null, phone: '+5491100000000' }), true);
  assert.equal(isContactable({ email: 'a@b.com', phone: '+5491100000000' }), true);
});

test('no contactable sin email ni teléfono, tratando el string vacío como ausente', () => {
  assert.equal(isContactable({ email: null, phone: null }), false);
  assert.equal(isContactable({}), false);
  assert.equal(isContactable({ email: '', phone: '' }), false);
});

// ── Programación de pasos ────────────────────────────────────────────────────

test('sin pasos enviados, el próximo vencimiento es la actividad + primer paso', () => {
  const last = hoursAgo(2);

  const next = nextEligibleAfter(last, 0, config());

  assert.equal(next?.toISOString(), new Date(last.getTime() + 1 * HOUR_MS).toISOString());
});

test('los offsets son acumulados desde la actividad, no entre pasos', () => {
  const last = hoursAgo(2);
  const cfg = config();

  assert.equal(
    nextEligibleAfter(last, 1, cfg)?.toISOString(),
    new Date(last.getTime() + 24 * HOUR_MS).toISOString(),
  );
  assert.equal(
    nextEligibleAfter(last, 2, cfg)?.toISOString(),
    new Date(last.getTime() + 72 * HOUR_MS).toISOString(),
  );
});

test('después del último paso no queda vencimiento', () => {
  assert.equal(nextEligibleAfter(hoursAgo(2), 3, config()), null);
});

test('si el carrito revive, el vencimiento se corre con la actividad nueva', () => {
  // Sin recalcular, el next_eligible_at viejo queda en el pasado y dispara un
  // recordatorio sobre un carrito que el cliente está usando en este momento.
  const cfg = config();
  const original = nextEligibleAfter(hoursAgo(10), 0, cfg);
  const revived = nextEligibleAfter(NOW, 0, cfg);

  assert.ok(original && revived);
  assert.ok(revived.getTime() > original.getTime());
  assert.ok(original.getTime() < NOW.getTime(), 'el viejo ya estaba vencido');
  assert.ok(revived.getTime() > NOW.getTime(), 'el nuevo queda a futuro');
});

test('nextStepFor respeta el umbral de inactividad de cada paso', () => {
  const cfg = config();

  assert.equal(nextStepFor(cfg, 0, 0.5), null, 'todavía no llegó al paso 1');
  assert.equal(nextStepFor(cfg, 0, 1)?.step, 1, 'el borde exacto es elegible');
  assert.equal(nextStepFor(cfg, 1, 23), null, 'paso 1 hecho, paso 2 no vencido');
  assert.equal(nextStepFor(cfg, 1, 24)?.step, 2);
  // Si se saltearon corridas, agarra el paso más avanzado que corresponde.
  assert.equal(nextStepFor(cfg, 0, 100)?.step, 1, 'nunca saltea pasos');
  assert.equal(nextStepFor(cfg, 2, 100)?.step, 3);
  assert.equal(nextStepFor(cfg, 3, 1000), null, 'secuencia agotada');
});

// ── Métricas ─────────────────────────────────────────────────────────────────

const row = (over: Partial<MetricsAggregateRow>): MetricsAggregateRow => ({
  status: 'pending',
  currency_code: 'ars',
  sales_channel_id: 'sc_main',
  contactable: true,
  count: 1,
  value: 0,
  ...over,
});

test('sin filas, todo en cero y sin dividir por cero en la tasa', () => {
  const m = shapeMetrics([]);

  assert.equal(m.total, 0);
  assert.equal(m.contactable, 0);
  assert.equal(m.uncontactable, 0);
  assert.equal(m.recovery_rate, 0);
  assert.deepEqual(m.by_status, {});
  assert.deepEqual(m.recoverable_value_by_currency, {});
});

test('separa contactables de sin contacto', () => {
  const m = shapeMetrics([
    row({ contactable: true, count: 310 }),
    row({ contactable: false, count: 930 }),
  ]);

  assert.equal(m.total, 1240);
  assert.equal(m.contactable, 310);
  assert.equal(m.uncontactable, 930);
});

test('la tasa de recuperación se calcula sobre contactables, no sobre el total', () => {
  // Incluir carritos que nunca se pudieron notificar mide la captura de contacto,
  // no la efectividad de la secuencia.
  const m = shapeMetrics([
    row({ status: 'pending', contactable: false, count: 900 }),
    row({ status: 'notified', contactable: true, count: 80 }),
    row({ status: 'recovered', contactable: true, count: 20 }),
  ]);

  assert.equal(m.contactable, 100);
  assert.equal(m.recovery_rate, 0.2);
});

test('los montos no mezclan monedas', () => {
  const m = shapeMetrics([
    row({ status: 'pending', currency_code: 'ars', value: 15000 }),
    row({ status: 'notified', currency_code: 'ars', value: 5000 }),
    row({ status: 'pending', currency_code: 'clp', value: 90000 }),
    row({ status: 'recovered', currency_code: 'ars', value: 7000 }),
  ]);

  assert.deepEqual(m.recoverable_value_by_currency, { ars: 20000, clp: 90000 });
  assert.deepEqual(m.recovered_value_by_currency, { ars: 7000 });
});

test('solo pending y notified cuentan como valor recuperable', () => {
  const m = shapeMetrics([
    row({ status: 'recovered', value: 500 }),
    row({ status: 'cancelled', value: 300 }),
  ]);

  assert.deepEqual(m.recoverable_value_by_currency, {});
  assert.deepEqual(m.recovered_value_by_currency, { ars: 500 });
});

test('agrupa por canal de venta y junta los huérfanos bajo unassigned', () => {
  const m = shapeMetrics([
    row({ sales_channel_id: 'sc_main', count: 5 }),
    row({ sales_channel_id: 'sc_demo', count: 3 }),
    row({ sales_channel_id: null, count: 2 }),
  ]);

  assert.deepEqual(m.by_sales_channel, { sc_main: 5, sc_demo: 3, unassigned: 2 });
});

test('normaliza la moneda a minúsculas y agrupa la ausente como unknown', () => {
  const m = shapeMetrics([
    row({ currency_code: 'ARS', value: 100 }),
    row({ currency_code: 'ars', value: 50 }),
    row({ currency_code: null, value: 25 }),
  ]);

  assert.deepEqual(m.recoverable_value_by_currency, { ars: 150, unknown: 25 });
});

test('tolera los strings que devuelve pg para COUNT y SUM', () => {
  // pg devuelve COUNT como bigint (string) y SUM(numeric) como string.
  const m = shapeMetrics([
    { ...row({}), count: '4' as unknown as number, value: '1200.50' as unknown as number },
  ]);

  assert.equal(m.total, 4);
  assert.deepEqual(m.recoverable_value_by_currency, { ars: 1200.5 });
});

test('un status desconocido no rompe ni desaparece del total', () => {
  const m = shapeMetrics([row({ status: 'algo_nuevo', count: 3 })]);

  assert.equal(m.total, 3);
  assert.equal(m.by_status.algo_nuevo, 3);
  assert.equal(m.recovery_rate, 0);
});
