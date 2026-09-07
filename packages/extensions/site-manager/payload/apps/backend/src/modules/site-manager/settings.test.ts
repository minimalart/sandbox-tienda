import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getConfiguredPlatformConnection, getPlatformConnection } from './settings.ts';

/**
 * El snapshot de `app-settings` arranca vacío en los tests: esto ejercita el
 * tramo **env > default** del resolver, o sea el comportamiento que la migración
 * tenía que preservar.
 */

const KEYS = ['MERCATTO_PLATFORM_URL', 'MERCATTO_PROJECT_ID', 'MERCATTO_PROJECT_SECRET'] as const;

function withEnv(vars: Partial<Record<(typeof KEYS)[number], string>>, body: () => void): void {
  const previous = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const key of KEYS) {
    const value = vars[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    body();
  } finally {
    for (const key of KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('la conexión sólo está configurada con las tres variables', () => {
  withEnv({}, () => assert.equal(getPlatformConnection().configured, false));
  withEnv({ MERCATTO_PLATFORM_URL: 'https://platform.test' }, () =>
    assert.equal(getPlatformConnection().configured, false));
  withEnv({ MERCATTO_PLATFORM_URL: 'https://platform.test', MERCATTO_PROJECT_ID: 'demo' }, () =>
    assert.equal(getPlatformConnection().configured, false));
  withEnv(
    { MERCATTO_PLATFORM_URL: 'https://platform.test', MERCATTO_PROJECT_ID: 'demo', MERCATTO_PROJECT_SECRET: 's3cr3t' },
    () => assert.equal(getPlatformConnection().configured, true),
  );
});

test('la barra final se recorta una sola vez y para todos los call sites', () => {
  // Antes cada ruta la recortaba por su cuenta y `extensions/route.ts` no lo
  // hacía: la misma instalación reportaba dos URLs distintas según el endpoint.
  withEnv({ MERCATTO_PLATFORM_URL: 'https://platform.test///' }, () =>
    assert.equal(getPlatformConnection().platformUrl, 'https://platform.test'));
});

test('una variable en blanco cuenta como ausente', () => {
  withEnv(
    { MERCATTO_PLATFORM_URL: 'https://platform.test', MERCATTO_PROJECT_ID: '   ', MERCATTO_PROJECT_SECRET: 's3cr3t' },
    () => {
      assert.equal(getPlatformConnection().projectId, null);
      assert.equal(getConfiguredPlatformConnection(), null);
    },
  );
});
