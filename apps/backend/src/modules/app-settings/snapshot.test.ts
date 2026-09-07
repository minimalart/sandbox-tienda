import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SettingDescriptor, SettingType } from './descriptors/types';

process.env.APP_SETTINGS_ENC_KEY = 'snapshot-test-key';
const { encryptSecret } = await import('./crypto.ts');
const {
  SNAPSHOT_TTL_MS,
  __resetSnapshot,
  __setSnapshotClock,
  getSnapshotRow,
  isSnapshotReady,
  registerSnapshotRefresher,
  replaceSnapshot,
  replaceSnapshotNamespace,
} = await import('./snapshot.ts');
const { resolveSettingSync, resolveNamespaceSync } = await import('./resolve.ts');
type AppSettingRow = import('./resolve.ts').AppSettingRow;

const d = (
  key: string,
  type: SettingType = 'string',
  extra: Partial<SettingDescriptor> = {},
): SettingDescriptor => ({
  key,
  namespace: 'extension:test',
  env: [key],
  type,
  tier: 'runtime',
  group: 'g',
  label: key,
  ...extra,
});

const row = (namespace: string, key: string, value: unknown): AppSettingRow & { namespace: string } => ({
  namespace,
  key,
  value,
  ciphertext: null,
  is_secret: false,
  updated_at: '2026-08-07T10:00:00.000Z',
  updated_by: null,
});

test('arranca vacío y no listo', () => {
  __resetSnapshot();
  assert.equal(isSnapshotReady(), false);
  assert.equal(getSnapshotRow('extension:test', 'HOST'), undefined);
});

test('replaceSnapshot indexa por namespace y key', () => {
  __resetSnapshot();
  replaceSnapshot([row('extension:a', 'HOST', 'a.local'), row('extension:b', 'HOST', 'b.local')]);
  assert.equal(isSnapshotReady(), true);
  assert.equal(getSnapshotRow('extension:a', 'HOST')?.value, 'a.local');
  assert.equal(getSnapshotRow('extension:b', 'HOST')?.value, 'b.local');
  assert.equal(getSnapshotRow('extension:c', 'HOST'), undefined);
});

test('replaceSnapshot REEMPLAZA todo: lo que ya no está, se va', () => {
  __resetSnapshot();
  replaceSnapshot([row('extension:a', 'HOST', 'viejo'), row('extension:a', 'PORT', 1)]);
  replaceSnapshot([row('extension:a', 'HOST', 'nuevo')]);
  assert.equal(getSnapshotRow('extension:a', 'HOST')?.value, 'nuevo');
  // Si PORT sobreviviera, borrar un ajuste desde el admin no tendría efecto en
  // el camino sincrónico hasta el próximo reinicio.
  assert.equal(getSnapshotRow('extension:a', 'PORT'), undefined);
});

test('replaceSnapshotNamespace toca UN namespace y no pisa los demás', () => {
  __resetSnapshot();
  replaceSnapshot([row('extension:a', 'HOST', 'a'), row('extension:b', 'HOST', 'b')]);
  replaceSnapshotNamespace('extension:a', [
    { key: 'HOST', value: 'a2', ciphertext: null, is_secret: false },
  ]);
  assert.equal(getSnapshotRow('extension:a', 'HOST')?.value, 'a2');
  assert.equal(getSnapshotRow('extension:b', 'HOST')?.value, 'b');
});

test('replaceSnapshotNamespace también reemplaza: borrar deja el namespace vacío', () => {
  __resetSnapshot();
  replaceSnapshot([row('extension:a', 'HOST', 'a'), row('extension:a', 'PORT', 1)]);
  replaceSnapshotNamespace('extension:a', []);
  assert.equal(getSnapshotRow('extension:a', 'HOST'), undefined);
  assert.equal(getSnapshotRow('extension:a', 'PORT'), undefined);
});

// ─── el camino sincrónico completo ───────────────────────────────────────────

test('sin snapshot, resolveSettingSync cae a env (comportamiento pre-migración)', () => {
  __resetSnapshot();
  process.env.SYNC_HOST = 'del-entorno';
  try {
    assert.equal(resolveSettingSync(d('SYNC_HOST')), 'del-entorno');
  } finally {
    delete process.env.SYNC_HOST;
  }
});

test('sin snapshot ni env, cae al default del descriptor', () => {
  __resetSnapshot();
  assert.equal(resolveSettingSync(d('SYNC_NADA', 'string', { default: 'por-defecto' })), 'por-defecto');
});

test('con snapshot, la DB gana sobre env', () => {
  __resetSnapshot();
  process.env.SYNC_HOST = 'del-entorno';
  try {
    replaceSnapshot([row('extension:test', 'SYNC_HOST', 'de-la-base')]);
    assert.equal(resolveSettingSync(d('SYNC_HOST')), 'de-la-base');
  } finally {
    delete process.env.SYNC_HOST;
  }
});

test('un secreto se descifra también por el camino sincrónico', () => {
  __resetSnapshot();
  replaceSnapshotNamespace('extension:test', [
    { key: 'SYNC_KEY', value: null, ciphertext: encryptSecret('sk-sync-1234'), is_secret: true },
  ]);
  assert.equal(resolveSettingSync(d('SYNC_KEY', 'secret')), 'sk-sync-1234');
});

test('un secreto indescifrable cae a env sin tirar', () => {
  __resetSnapshot();
  process.env.SYNC_KEY = 'del-entorno';
  try {
    replaceSnapshotNamespace('extension:test', [
      { key: 'SYNC_KEY', value: null, ciphertext: 'v1:zz:zz:zz', is_secret: true },
    ]);
    assert.equal(resolveSettingSync(d('SYNC_KEY', 'secret')), 'del-entorno');
  } finally {
    delete process.env.SYNC_KEY;
  }
});

test('resolveNamespaceSync devuelve el namespace entero indexado por key', () => {
  __resetSnapshot();
  replaceSnapshot([row('extension:test', 'A', 'a'), row('extension:test', 'B', 2)]);
  assert.deepEqual(resolveNamespaceSync([d('A'), d('B', 'number'), d('C')]), {
    A: 'a',
    B: 2,
    C: undefined,
  });
});

// ─── revalidación en segundo plano (stale-while-revalidate) ──────────────────
//
// Sin esto, con N réplicas, guardar desde el admin actualizaba SÓLO el proceso
// que escribió: el camino async tenía TTL y el sincrónico no, así que las otras
// N-1 se quedaban con el valor viejo hasta el próximo reinicio.

test('vencido el TTL, una lectura dispara la recarga en segundo plano', async () => {
  __resetSnapshot();
  let clock = 0;
  __setSnapshotClock(() => clock);
  try {
    replaceSnapshot([row('extension:a', 'HOST', 'viejo')]);

    let refreshes = 0;
    registerSnapshotRefresher(async () => {
      refreshes++;
      // El `await` importa: un refresher real espera a Postgres. Sin él, el
      // cuerpo de la async corre sincrónicamente y el snapshot se reemplaza
      // ANTES de que la lectura devuelva, que no es el caso a testear.
      await new Promise((r) => setImmediate(r));
      replaceSnapshot([row('extension:a', 'HOST', 'nuevo')]);
    });

    // Dentro del TTL no recarga.
    assert.equal(getSnapshotRow('extension:a', 'HOST')?.value, 'viejo');
    assert.equal(refreshes, 0);

    clock = SNAPSHOT_TTL_MS + 1;
    // La lectura que encuentra el snapshot vencido devuelve lo VIEJO —es
    // sincrónica, no puede esperar— pero dispara la recarga.
    assert.equal(getSnapshotRow('extension:a', 'HOST')?.value, 'viejo');
    assert.equal(refreshes, 1);

    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // La siguiente ya ve lo nuevo.
    assert.equal(getSnapshotRow('extension:a', 'HOST')?.value, 'nuevo');
  } finally {
    __setSnapshotClock(() => Date.now());
  }
});

test('N lecturas vencidas concurrentes disparan UNA sola recarga', async () => {
  __resetSnapshot();
  let clock = 0;
  __setSnapshotClock(() => clock);
  try {
    replaceSnapshot([row('extension:a', 'HOST', 'viejo')]);
    let refreshes = 0;
    registerSnapshotRefresher(async () => {
      refreshes++;
      await new Promise((r) => setImmediate(r));
      replaceSnapshot([row('extension:a', 'HOST', 'nuevo')]);
    });

    clock = SNAPSHOT_TTL_MS + 1;
    for (let i = 0; i < 20; i++) getSnapshotRow('extension:a', 'HOST');
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(refreshes, 1);
  } finally {
    __setSnapshotClock(() => Date.now());
  }
});

test('si la recarga falla, se conserva el snapshot viejo y no se propaga el error', async () => {
  __resetSnapshot();
  let clock = 0;
  __setSnapshotClock(() => clock);
  try {
    replaceSnapshot([row('extension:a', 'HOST', 'viejo')]);
    let attempts = 0;
    registerSnapshotRefresher(async () => {
      attempts++;
      throw new Error('postgres parpadeó');
    });

    clock = SNAPSHOT_TTL_MS + 1;
    // No tira: leer configuración no puede romperse porque la base parpadee.
    assert.equal(getSnapshotRow('extension:a', 'HOST')?.value, 'viejo');
    assert.equal(attempts, 1);

    await new Promise((r) => setImmediate(r));

    // El snapshot viejo sobrevive al fallo, y el flag de "recargando" se
    // liberó: la próxima lectura vencida vuelve a intentar en vez de quedar
    // trabada para siempre.
    assert.equal(getSnapshotRow('extension:a', 'HOST')?.value, 'viejo');
    assert.equal(attempts, 2);
  } finally {
    __setSnapshotClock(() => Date.now());
  }
});

test('sin refresher registrado, leer vencido no rompe', () => {
  __resetSnapshot();
  let clock = 0;
  __setSnapshotClock(() => clock);
  try {
    replaceSnapshot([row('extension:a', 'HOST', 'viejo')]);
    clock = SNAPSHOT_TTL_MS + 1;
    assert.equal(getSnapshotRow('extension:a', 'HOST')?.value, 'viejo');
  } finally {
    __setSnapshotClock(() => Date.now());
  }
});

test('APP_SETTINGS_DISABLE también apaga el camino sincrónico', () => {
  __resetSnapshot();
  process.env.SYNC_HOST = 'del-entorno';
  process.env.APP_SETTINGS_DISABLE = 'true';
  try {
    replaceSnapshot([row('extension:test', 'SYNC_HOST', 'de-la-base')]);
    assert.equal(resolveSettingSync(d('SYNC_HOST')), 'del-entorno');
  } finally {
    delete process.env.SYNC_HOST;
    delete process.env.APP_SETTINGS_DISABLE;
  }
});
