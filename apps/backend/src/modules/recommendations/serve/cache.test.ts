import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  configCacheTtlMs,
  __setClock,
  invalidateActiveVersions,
  invalidateAll,
  invalidateConfig,
  memo,
} from './cache';

let clock = 0;
__setClock(() => clock);

beforeEach(() => {
  clock = 0;
  invalidateAll();
});

describe('memo', () => {
  it('calcula una vez y después devuelve lo cacheado', async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      return 'valor';
    };
    assert.equal(await memo('k', loader), 'valor');
    assert.equal(await memo('k', loader), 'valor');
    assert.equal(calls, 1);
  });

  it('recalcula al expirar el TTL', async () => {
    // El TTL corto es lo que hace que un cambio del backoffice se vea sin reiniciar.
    let calls = 0;
    const loader = async () => `v${++calls}`;
    assert.equal(await memo('k', loader), 'v1');
    clock += configCacheTtlMs() + 1;
    assert.equal(await memo('k', loader), 'v2');
  });

  it('sigue sirviendo dentro del TTL', async () => {
    let calls = 0;
    const loader = async () => `v${++calls}`;
    await memo('k', loader);
    clock += configCacheTtlMs() - 1;
    assert.equal(await memo('k', loader), 'v1');
  });

  it('colapsa requests concurrentes en una sola carga', async () => {
    // Con la cache fría, 20 requests simultáneos tienen que compartir UNA lectura;
    // si se cacheara el valor resuelto en vez de la promesa, dispararían 20.
    let calls = 0;
    let release: (value: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      release = resolve;
    });
    const loader = () => {
      calls++;
      return pending;
    };

    const inflight = Array.from({ length: 20 }, () => memo('k', loader));
    release('valor');
    const results = await Promise.all(inflight);

    assert.equal(calls, 1);
    assert.deepEqual(new Set(results), new Set(['valor']));
  });

  it('no cachea errores', async () => {
    // Cachear un error dejaría el motor roto hasta que expire el TTL.
    let calls = 0;
    const failing = async () => {
      calls++;
      throw new Error('boom');
    };
    await assert.rejects(() => memo('k', failing), /boom/);
    await assert.rejects(() => memo('k', failing), /boom/);
    assert.equal(calls, 2);
  });

  it('recupera después de un error', async () => {
    await assert.rejects(
      () =>
        memo('k', async () => {
          throw new Error('boom');
        }),
      /boom/,
    );
    assert.equal(await memo('k', async () => 'ok'), 'ok');
  });

  it('mantiene las claves independientes', async () => {
    assert.equal(await memo('a', async () => 1), 1);
    assert.equal(await memo('b', async () => 2), 2);
    assert.equal(await memo('a', async () => 99), 1);
  });
});

describe('invalidación', () => {
  it('invalidateActiveVersions sólo borra las versiones activas', async () => {
    // Es la única entrada cuyo desfase produce datos INCORRECTOS (relaciones de una
    // versión ya reemplazada) y no sólo configuración vieja: la llama el swap.
    await memo('active-versions', async () => 'v1');
    await memo('config', async () => 'c1');
    invalidateActiveVersions();
    assert.equal(await memo('active-versions', async () => 'v2'), 'v2');
    assert.equal(await memo('config', async () => 'c2'), 'c1');
  });

  it('invalidateConfig borra config, placements y estrategias', async () => {
    await memo('config', async () => 'c1');
    await memo('placements', async () => 'p1');
    await memo('strategies', async () => 's1');
    await memo('active-versions', async () => 'v1');
    invalidateConfig();
    assert.equal(await memo('config', async () => 'c2'), 'c2');
    assert.equal(await memo('placements', async () => 'p2'), 'p2');
    assert.equal(await memo('strategies', async () => 's2'), 's2');
    assert.equal(await memo('active-versions', async () => 'v2'), 'v1');
  });

  it('invalidateAll borra todo', async () => {
    await memo('config', async () => 'c1');
    await memo('active-versions', async () => 'v1');
    invalidateAll();
    assert.equal(await memo('config', async () => 'c2'), 'c2');
    assert.equal(await memo('active-versions', async () => 'v2'), 'v2');
  });
});
