import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerAppSettingsSyncReader } from '@minimalart/mercatto-plugin-runtime';
import { getGa4Settings, mergeWithLegacyRow } from './settings';

/**
 * En el plugin la resolución es **snapshot > env > default**. La capa de
 * snapshot vive en el host (`app-settings`) y el plugin la recibe vía
 * `@minimalart/mercatto-plugin-runtime`. Estos tests ejercitan la ruta con
 * el reader conectado (registramos un mock en el runtime) y el fallback puro
 * a env cuando el registry está vacío. La capa de base necesita Postgres y
 * vive en el host, así que no se testea acá.
 */

const ENV_KEYS = [
  'GA_MEASUREMENT_ID',
  'NEXT_PUBLIC_GA_MEASUREMENT_ID',
  'GA_API_SECRET',
  'GTM_ID',
  'NEXT_PUBLIC_GTM_ID',
  'GA_DEBUG',
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  registerAppSettingsSyncReader(null);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  registerAppSettingsSyncReader(null);
});

function withReader(map: Record<string, unknown>): void {
  registerAppSettingsSyncReader((namespace, key) => {
    assert.equal(namespace, 'extension:ga4');
    return map[key];
  });
}

test('sin nada configurado cae a los defaults', () => {
  assert.deepEqual(getGa4Settings(), {
    measurementId: null,
    apiSecret: null,
    gtmId: null,
    debug: false,
  });
});

test('el alias NEXT_PUBLIC_ actúa de fallback, no de reemplazo', () => {
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-PUBLICO';
  assert.equal(getGa4Settings().measurementId, 'G-PUBLICO');

  process.env.GA_MEASUREMENT_ID = 'G-BACKEND';
  assert.equal(getGa4Settings().measurementId, 'G-BACKEND');
});

test('GA_DEBUG solo es true con el string "true"', () => {
  process.env.GA_DEBUG = 'false';
  assert.equal(getGa4Settings().debug, false);

  process.env.GA_DEBUG = 'true';
  assert.equal(getGa4Settings().debug, true);
});

test('el snapshot del host le gana al env cuando el bridge está conectado', () => {
  process.env.GA_MEASUREMENT_ID = 'G-DELENV';
  withReader({ GA_MEASUREMENT_ID: 'G-DELADMIN' });
  assert.equal(getGa4Settings().measurementId, 'G-DELADMIN');
});

test('cuando el reader devuelve undefined para una key, se cae al env', () => {
  process.env.GA_MEASUREMENT_ID = 'G-DELENV';
  withReader({ GA_API_SECRET: 'secret-del-admin' });
  const settings = getGa4Settings();
  assert.equal(settings.measurementId, 'G-DELENV');
  assert.equal(settings.apiSecret, 'secret-del-admin');
});

test('un reader que tira NO rompe el getter: se cae al env sin propagar el error', () => {
  process.env.GA_MEASUREMENT_ID = 'G-DELENV';
  registerAppSettingsSyncReader(() => {
    throw new Error('snapshot no está listo');
  });
  assert.equal(getGa4Settings().measurementId, 'G-DELENV');
});

test('la fila legacy le gana al env pero pierde contra el snapshot', () => {
  process.env.GA_MEASUREMENT_ID = 'G-DELENV';
  process.env.GTM_ID = 'GTM-DELENV';

  // Sin reader, manda la legacy sobre el env.
  let merged = mergeWithLegacyRow({ measurement_id: 'G-LEGACY', gtm_id: 'GTM-LEGACY' });
  assert.equal(merged.measurementId, 'G-LEGACY');
  assert.equal(merged.gtmId, 'GTM-LEGACY');

  // Con snapshot para una sola key, esa key cambia y la otra no.
  withReader({ GA_MEASUREMENT_ID: 'G-DELADMIN' });
  merged = mergeWithLegacyRow({ measurement_id: 'G-LEGACY', gtm_id: 'GTM-LEGACY' });
  assert.equal(merged.measurementId, 'G-DELADMIN');
  assert.equal(merged.gtmId, 'GTM-LEGACY');
});

test('una columna legacy en NULL no congela el env: cae al valor heredado', () => {
  process.env.GA_MEASUREMENT_ID = 'G-DELENV';
  const merged = mergeWithLegacyRow({ measurement_id: null, api_secret: null, gtm_id: null });
  assert.equal(merged.measurementId, 'G-DELENV');
});

test('sin reader registrado, el getter usa el env directamente (host sin app-settings)', () => {
  process.env.GA_MEASUREMENT_ID = 'G-DELENV';
  registerAppSettingsSyncReader(null);
  assert.equal(getGa4Settings().measurementId, 'G-DELENV');
  assert.equal(mergeWithLegacyRow({ measurement_id: 'G-LEGACY' }).measurementId, 'G-LEGACY');
});
