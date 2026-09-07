import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SETTINGS_CACHE_TTL_MS,
  __setClock,
  invalidateAllNamespaces,
  invalidateNamespace,
  memoNamespace,
} from './settings-cache';

let clock = 0;
__setClock(() => clock);

test('cachea por namespace y no vuelve a llamar al loader', async () => {
  invalidateAllNamespaces();
  let calls = 0;
  const load = async () => {
    calls++;
    return 'v1';
  };
  assert.equal(await memoNamespace('ns:a', load), 'v1');
  assert.equal(await memoNamespace('ns:a', load), 'v1');
  assert.equal(calls, 1);
});

test('namespaces distintos no se pisan', async () => {
  invalidateAllNamespaces();
  assert.equal(await memoNamespace('ns:a', async () => 'A'), 'A');
  assert.equal(await memoNamespace('ns:b', async () => 'B'), 'B');
  assert.equal(await memoNamespace('ns:a', async () => 'otro'), 'A');
});

test('vencido el TTL se recalcula', async () => {
  invalidateAllNamespaces();
  clock = 0;
  let calls = 0;
  const load = async () => {
    calls++;
    return calls;
  };
  assert.equal(await memoNamespace('ns:a', load), 1);
  clock = SETTINGS_CACHE_TTL_MS + 1;
  assert.equal(await memoNamespace('ns:a', load), 2);
});

test('N lecturas frías simultáneas disparan UNA sola query (stampede)', async () => {
  invalidateAllNamespaces();
  let calls = 0;
  const load = async () => {
    calls++;
    await new Promise((r) => setImmediate(r));
    return 'x';
  };
  const all = await Promise.all(Array.from({ length: 20 }, () => memoNamespace('ns:a', load)));
  assert.equal(calls, 1);
  assert.deepEqual(new Set(all), new Set(['x']));
});

test('un error NO queda cacheado: el próximo intento reintenta', async () => {
  invalidateAllNamespaces();
  let calls = 0;
  const flaky = async () => {
    calls++;
    if (calls === 1) throw new Error('postgres parpadeó');
    return 'ok';
  };
  await assert.rejects(() => memoNamespace('ns:a', flaky));
  assert.equal(await memoNamespace('ns:a', flaky), 'ok');
  assert.equal(calls, 2);
});

test('invalidateNamespace fuerza la relectura en el mismo proceso', async () => {
  invalidateAllNamespaces();
  clock = 0;
  let calls = 0;
  const load = async () => {
    calls++;
    return calls;
  };
  assert.equal(await memoNamespace('ns:a', load), 1);
  invalidateNamespace('ns:a');
  assert.equal(await memoNamespace('ns:a', load), 2);
});
