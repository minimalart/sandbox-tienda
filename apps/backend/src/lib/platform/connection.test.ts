import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getConfiguredPlatformConnection, getPlatformConnection, platformAuthHeaders } from './connection';

const env = (extra: Record<string, string | undefined> = {}) => ({
  MERCATTO_PLATFORM_URL: 'https://platform.mercatto.co',
  MERCATTO_PROJECT_ID: 'proj_1',
  MERCATTO_PROJECT_SECRET: 'sk_1',
  ...extra,
});

// ─── barra final ─────────────────────────────────────────────────────────────

test('recorta la barra final de la URL', () => {
  const { platformUrl } = getPlatformConnection(env({ MERCATTO_PLATFORM_URL: 'https://platform.mercatto.co/' }));
  assert.equal(platformUrl, 'https://platform.mercatto.co');
});

test('recorta también varias barras finales', () => {
  const { platformUrl } = getPlatformConnection(env({ MERCATTO_PLATFORM_URL: 'https://platform.mercatto.co///' }));
  assert.equal(platformUrl, 'https://platform.mercatto.co');
});

test('la URL con y sin barra final dan el MISMO valor: era el bug de las dos URLs', () => {
  const conBarra = getPlatformConnection(env({ MERCATTO_PLATFORM_URL: 'https://platform.mercatto.co/' }));
  const sinBarra = getPlatformConnection(env({ MERCATTO_PLATFORM_URL: 'https://platform.mercatto.co' }));
  assert.equal(conBarra.platformUrl, sinBarra.platformUrl);
});

test('no toca las barras del medio', () => {
  const { platformUrl } = getPlatformConnection(env({ MERCATTO_PLATFORM_URL: 'https://platform.mercatto.co/api/' }));
  assert.equal(platformUrl, 'https://platform.mercatto.co/api');
});

test('recorta los espacios alrededor', () => {
  const { platformUrl } = getPlatformConnection(env({ MERCATTO_PLATFORM_URL: '  https://platform.mercatto.co/  ' }));
  assert.equal(platformUrl, 'https://platform.mercatto.co');
});

// ─── configured ──────────────────────────────────────────────────────────────

test('configured: true sólo con las tres', () => {
  assert.equal(getPlatformConnection(env()).configured, true);
});

for (const missing of ['MERCATTO_PLATFORM_URL', 'MERCATTO_PROJECT_ID', 'MERCATTO_PROJECT_SECRET']) {
  test(`configured: false si falta ${missing}`, () => {
    assert.equal(getPlatformConnection(env({ [missing]: undefined })).configured, false);
  });

  test(`configured: false si ${missing} está vacío — un env seteado en vacío es ausente`, () => {
    assert.equal(getPlatformConnection(env({ [missing]: '' })).configured, false);
    assert.equal(getPlatformConnection(env({ [missing]: '   ' })).configured, false);
  });
}

test('un env vacío deja el campo en null, no en cadena vacía', () => {
  const connection = getPlatformConnection(env({ MERCATTO_PROJECT_ID: '  ' }));
  assert.equal(connection.projectId, null);
  assert.equal(connection.projectSecret, 'sk_1');
});

test('sin ninguna variable: todo null y configured false', () => {
  assert.deepEqual(getPlatformConnection({}), {
    platformUrl: null,
    projectId: null,
    projectSecret: null,
    configured: false,
  });
});

// ─── getConfiguredPlatformConnection / headers ───────────────────────────────

test('getConfiguredPlatformConnection devuelve la conexión completa y ya normalizada', () => {
  assert.deepEqual(getConfiguredPlatformConnection(env({ MERCATTO_PLATFORM_URL: 'https://platform.mercatto.co/' })), {
    platformUrl: 'https://platform.mercatto.co',
    projectId: 'proj_1',
    projectSecret: 'sk_1',
  });
});

test('getConfiguredPlatformConnection devuelve null si la conexión está a medias', () => {
  assert.equal(getConfiguredPlatformConnection(env({ MERCATTO_PROJECT_SECRET: '' })), null);
});

test('platformAuthHeaders manda id y secret', () => {
  assert.deepEqual(platformAuthHeaders({ platformUrl: 'https://x', projectId: 'proj_1', projectSecret: 'sk_1' }), {
    'x-mercatto-project-id': 'proj_1',
    'x-mercatto-project-secret': 'sk_1',
  });
});
