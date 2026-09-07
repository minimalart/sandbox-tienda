import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AppSettingRow } from '../app-settings/resolve.ts';
import { __resetSnapshot, replaceSnapshot } from '../app-settings/snapshot.ts';
import {
  RECOMMENDATIONS_FLOORS,
  RECOMMENDATIONS_SETTINGS_NAMESPACE,
  clampFloor,
  getRecommendationsSettings,
} from './settings.ts';

/**
 * La resolución de la configuración operativa del motor.
 *
 * Se testea sin base porque no hace falta ninguna: el camino es
 * `snapshot (Map en memoria) → process.env → default del descriptor`, y las tres
 * capas son inyectables desde acá. Lo que se verifica no son las queries sino las
 * decisiones — qué capa gana, qué pasa con un valor basura en el entorno, y que los
 * pisos sigan pegando cuando la validación de la UI no participa.
 */

/** Sobre de `site_setting` tal como lo guarda `mergeNamespaceBlob`. */
const row = (key: string, value: unknown): AppSettingRow & { namespace: string } => ({
  namespace: RECOMMENDATIONS_SETTINGS_NAMESPACE,
  key,
  value,
  ciphertext: null,
  is_secret: false,
  updated_at: null,
  updated_by: null,
});

const ENV_KEYS = [
  'RECOMMENDATIONS_ENABLED',
  'RECOMMENDATIONS_JOBS_ENABLED',
  'RECOMMENDATIONS_DEBUG',
  'RECOMMENDATIONS_EVENT_SECRET',
  'RECOMMENDATIONS_RATE_LIMIT_PER_MINUTE',
  'RECOMMENDATIONS_CONFIG_TTL_MS',
  'RECOMMENDATIONS_BUILD_MAX_MS',
  'RECOMMENDATIONS_BUILD_BATCH',
  'RECOMMENDATIONS_STALE_MINUTES',
  'RECOMMENDATIONS_AGGREGATE_LOOKBACK_HOURS',
  'RECOMMENDATIONS_PURGE_BATCH',
  'RECOMMENDATIONS_PURGE_MAX_BATCHES',
  'APP_SETTINGS_DISABLE',
];

beforeEach(() => {
  __resetSnapshot();
  for (const key of ENV_KEYS) delete process.env[key];
});

/* -------------------------------------------------------------------------- */
/* clampFloor                                                                  */
/* -------------------------------------------------------------------------- */

test('clampFloor devuelve el número cuando es utilizable', () => {
  assert.equal(clampFloor(300, 100, 5000), 300);
  assert.equal(clampFloor('300', 100, 5000), 300);
  assert.equal(clampFloor(' 300 ', 100, 5000), 300);
});

test('clampFloor sube al piso lo que quedó por debajo', () => {
  // Es el único filtro que ve un valor puesto a mano en el panel de deploy:
  // `coerceFromEnv` no valida rangos a propósito.
  assert.equal(clampFloor(1, 100, 5000), 100);
  assert.equal(clampFloor(-50, 100, 5000), 100);
});

test('clampFloor cae al default cuando no hay número, y el default también respeta el piso', () => {
  for (const bad of [undefined, null, '', '   ', 'muchos', NaN, Infinity, {}]) {
    assert.equal(clampFloor(bad, 100, 5000), 5000, `${String(bad)} debería caer al default`);
  }
  // Un default mal escrito no puede colarse por debajo del piso.
  assert.equal(clampFloor(undefined, 100, 1), 100);
});

test('clampFloor trata el CERO como número y no como ausencia', () => {
  // Cambio deliberado contra el `Math.max(piso, Number(env) || default)` que había
  // repetido en ocho lugares: `0` es falsy, así que caía al default. Quien escribe
  // `0` está pidiendo lo mínimo posible, no lo que venga por defecto.
  assert.equal(clampFloor(0, 100, 5000), 100);
  assert.equal(clampFloor('0', 100, 5000), 100);
});

/* -------------------------------------------------------------------------- */
/* Precedencia                                                                 */
/* -------------------------------------------------------------------------- */

test('sin snapshot ni env se comporta como antes de la migración', () => {
  // Los defaults del descriptor son exactamente los que estaban hardcodeados en los
  // ocho `Math.max(...)`. Instalar esto no puede cambiar cómo corre una instalación
  // viva que no configuró nada.
  const s = getRecommendationsSettings();
  assert.equal(s.enabled, true);
  assert.equal(s.jobsEnabled, true);
  assert.equal(s.debug, false);
  assert.equal(s.eventSecret, null);
  assert.equal(s.rateLimitPerMinute, 120);
  assert.equal(s.configCacheTtlMs, 60_000);
  assert.equal(s.buildMaxMs, 20_000);
  assert.equal(s.buildBatch, 200);
  assert.equal(s.staleMinutes, 30);
  assert.equal(s.aggregateLookbackHours, 48);
  assert.equal(s.purgeBatch, 5000);
  assert.equal(s.purgeMaxBatches, 20);
});

test('el entorno le gana al default', () => {
  process.env.RECOMMENDATIONS_BUILD_BATCH = '500';
  process.env.RECOMMENDATIONS_DEBUG = 'true';
  const s = getRecommendationsSettings();
  assert.equal(s.buildBatch, 500);
  assert.equal(s.debug, true);
});

test('la fila GLOBAL le gana al entorno', () => {
  process.env.RECOMMENDATIONS_BUILD_BATCH = '500';
  replaceSnapshot([row('RECOMMENDATIONS_BUILD_BATCH', 900)]);
  assert.equal(getRecommendationsSettings().buildBatch, 900);
});

test('un valor de base fuera de rango igual se clampea al piso', () => {
  // La UI no deja guardar por debajo del `min`, pero un UPDATE a mano o un dump viejo
  // sí pueden dejar la fila así. El piso es la última línea.
  replaceSnapshot([row('RECOMMENDATIONS_PURGE_BATCH', 3)]);
  assert.equal(getRecommendationsSettings().purgeBatch, RECOMMENDATIONS_FLOORS.purgeBatch);
});

test('un entorno basura no rompe: cae al default', () => {
  process.env.RECOMMENDATIONS_STALE_MINUTES = 'media hora';
  assert.equal(getRecommendationsSettings().staleMinutes, 30);
});

test('APP_SETTINGS_DISABLE ignora la base y devuelve el entorno', () => {
  // El break-glass del sistema: con un valor mal guardado que deja el motor caído,
  // esto tiene que devolver el comportamiento exacto de antes de la migración.
  process.env.APP_SETTINGS_DISABLE = 'true';
  process.env.RECOMMENDATIONS_BUILD_BATCH = '500';
  replaceSnapshot([row('RECOMMENDATIONS_BUILD_BATCH', 900)]);
  assert.equal(getRecommendationsSettings().buildBatch, 500);
});

/* -------------------------------------------------------------------------- */
/* Kill switches                                                               */
/* -------------------------------------------------------------------------- */

test('apagar el motor apaga también los jobs, y no al revés', () => {
  // La combinación se hace acá y no en cada job: que los cuatro se acuerden de
  // chequear las dos banderas es la clase de invariante que se rompe cuando alguien
  // agrega el quinto.
  replaceSnapshot([row('RECOMMENDATIONS_ENABLED', false)]);
  const off = getRecommendationsSettings();
  assert.equal(off.enabled, false);
  assert.equal(off.jobsEnabled, false);

  __resetSnapshot();
  replaceSnapshot([row('RECOMMENDATIONS_JOBS_ENABLED', false)]);
  const jobsOff = getRecommendationsSettings();
  assert.equal(jobsOff.enabled, true, 'apagar los jobs no puede apagar el serve');
  assert.equal(jobsOff.jobsEnabled, false);
});

test('`RECOMMENDATIONS_ENABLED=false` en el entorno sigue apagando el motor', () => {
  // Es LA forma documentada de apagar la extensión y hay instalaciones vivas que la
  // usan: la migración no puede haberla roto.
  process.env.RECOMMENDATIONS_ENABLED = 'false';
  assert.equal(getRecommendationsSettings().enabled, false);
});

test('la fila de base puede volver a PRENDER lo que el entorno apagó', () => {
  // Es la razón de ser de la migración: sin esto, apagar el motor requiere un deploy
  // y volver a prenderlo, otro.
  process.env.RECOMMENDATIONS_ENABLED = 'false';
  replaceSnapshot([row('RECOMMENDATIONS_ENABLED', true)]);
  assert.equal(getRecommendationsSettings().enabled, true);
});

/* -------------------------------------------------------------------------- */
/* Secreto                                                                     */
/* -------------------------------------------------------------------------- */

test('el secreto de firma ausente es `null`, no cadena vacía', () => {
  // La AUSENCIA es significativa: `resolveEventSecret` la usa para caer a
  // `COOKIE_SECRET`, y una cadena vacía pasaría el `if (explicit)` de forma distinta
  // según cómo esté escrito el chequeo.
  assert.equal(getRecommendationsSettings().eventSecret, null);
  process.env.RECOMMENDATIONS_EVENT_SECRET = '   ';
  assert.equal(getRecommendationsSettings().eventSecret, null, 'sólo espacios es ausencia');
});

test('el secreto de firma se lee del entorno tal cual', () => {
  process.env.RECOMMENDATIONS_EVENT_SECRET = 's3cr3t0-de-firma';
  assert.equal(getRecommendationsSettings().eventSecret, 's3cr3t0-de-firma');
});
