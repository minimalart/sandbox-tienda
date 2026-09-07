import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SettingDescriptor } from './descriptors/types';
import type { SiteRef, SiteResolution } from '../../lib/multistore/types';
import { resolveByPrecedence, resolveForSite, siteKindOf } from './precedence';

const d = (extra: Partial<SettingDescriptor> = {}): SettingDescriptor => ({
  key: 'X',
  namespace: 'extension:test',
  env: ['X'],
  type: 'string',
  tier: 'runtime',
  group: 'g',
  label: 'X',
  ...extra,
});

const ref = (is_main: boolean): SiteRef => ({
  id: 'demo_1',
  slug: 'norte',
  name: 'Norte',
  is_main,
  channel_ids: ['sc_1'],
  region_id: null,
  stock_location_id: null,
});

/** Las cuatro capas cargadas, para que cada test sólo tenga que sacar la suya. */
const all = { site: 'SITE', global: 'GLOBAL', env: 'ENV', descriptor: d({ default: 'DEF' }) };

// ─── Regla 1: is_main → site ?? global ?? env ?? default ─────────────────────

test('main: la fila de la tienda gana con todas las capas presentes', () => {
  assert.deepEqual(resolveByPrecedence({ kind: 'main', ...all }), {
    value: 'SITE',
    source: 'site',
  });
});

test('main: sin fila propia cae a la global', () => {
  assert.deepEqual(resolveByPrecedence({ kind: 'main', ...all, site: undefined }), {
    value: 'GLOBAL',
    source: 'global',
  });
});

test('main: sin fila propia ni global cae al env', () => {
  assert.deepEqual(
    resolveByPrecedence({ kind: 'main', ...all, site: undefined, global: undefined }),
    { value: 'ENV', source: 'env' },
  );
});

test('main: el default del descriptor es el último eslabón', () => {
  assert.deepEqual(
    resolveByPrecedence({
      kind: 'main',
      site: undefined,
      global: undefined,
      env: undefined,
      descriptor: d({ default: 'DEF' }),
    }),
    { value: 'DEF', source: 'default' },
  );
});

test('main: sin ninguna capa da unset, que NO es off', () => {
  const r = resolveByPrecedence({ kind: 'main', descriptor: d() });
  assert.deepEqual(r, { value: undefined, source: 'unset' });
  // La distinción es la que hace que a la tienda principal a la que le falta una
  // credencial required la UI le diga "sin configurar" y no "apagado a propósito".
  assert.notEqual(r.source, 'off');
});

// ─── Regla 2: NO main → site ?? OFF (fail-closed) ────────────────────────────

test('secundaria: con fila propia usa la suya', () => {
  assert.deepEqual(resolveByPrecedence({ kind: 'secondary', ...all }), {
    value: 'SITE',
    source: 'site',
  });
});

test('SECUNDARIA SIN FILA PROPIA DA off AUNQUE HAYA GLOBAL, ENV Y DEFAULT', () => {
  // Este test NO es redundante con el de abajo y no se "arregla" haciéndolo heredar.
  // Es la decisión 3 entera: si esto cayera a la global, una tienda secundaria
  // despacharía con la cuenta de Andreani de otra, facturaría contra su CUIT y
  // mandaría WhatsApps desde su número. Que las tres capas de abajo estén CARGADAS
  // es el punto: se ignoran a propósito.
  assert.deepEqual(resolveByPrecedence({ kind: 'secondary', ...all, site: undefined }), {
    value: undefined,
    source: 'off',
  });
});

test('secundaria: sin ninguna capa también da off (nunca unset)', () => {
  assert.deepEqual(resolveByPrecedence({ kind: 'secondary', descriptor: d() }), {
    value: undefined,
    source: 'off',
  });
});

test('secundaria: el default del descriptor NO la rescata', () => {
  assert.deepEqual(
    resolveByPrecedence({ kind: 'secondary', descriptor: d({ default: 'DEF' }) }),
    { value: undefined, source: 'off' },
  );
});

// ─── Regla 3: sin site (mono-tienda) → global ?? env ?? default ──────────────

test('none: la global gana', () => {
  assert.deepEqual(resolveByPrecedence({ kind: 'none', ...all, site: undefined }), {
    value: 'GLOBAL',
    source: 'global',
  });
});

test('none: IGNORA la capa de tienda aunque venga cargada', () => {
  // Es lo único que distingue `none` de `main`. Si esto devolviera 'SITE', el admin
  // sin tienda elegida vería la config de una tienda cualquiera en vez de la de la
  // instancia — y guardaría creyendo que edita la global.
  assert.deepEqual(resolveByPrecedence({ kind: 'none', ...all }), {
    value: 'GLOBAL',
    source: 'global',
  });
});

test('none: sin global cae a env, después a default, después a unset', () => {
  const base = { kind: 'none' as const, site: 'SITE' };
  assert.deepEqual(resolveByPrecedence({ ...base, env: 'ENV', descriptor: d({ default: 'DEF' }) }), {
    value: 'ENV',
    source: 'env',
  });
  assert.deepEqual(resolveByPrecedence({ ...base, descriptor: d({ default: 'DEF' }) }), {
    value: 'DEF',
    source: 'default',
  });
  assert.deepEqual(resolveByPrecedence({ ...base, descriptor: d() }), {
    value: undefined,
    source: 'unset',
  });
});

// ─── null explícito vs undefined ─────────────────────────────────────────────

test('null en la fila de la tienda es AUSENCIA: main sigue de largo a la global', () => {
  // `coerceAndValidate` no puede producir un null: sale de una fila legacy, de un
  // UPDATE a mano o de un `{"X": null}` en el jsonb. Honrarlo sería resolver a
  // "configurado con null" y dejar que el consumidor cobre con un token nulo.
  assert.deepEqual(resolveByPrecedence({ kind: 'main', ...all, site: null }), {
    value: 'GLOBAL',
    source: 'global',
  });
});

test('null en la fila de una secundaria da off, igual que si no existiera', () => {
  assert.deepEqual(resolveByPrecedence({ kind: 'secondary', ...all, site: null }), {
    value: undefined,
    source: 'off',
  });
});

test('null en global y en env también son ausencia', () => {
  assert.deepEqual(resolveByPrecedence({ kind: 'main', ...all, site: null, global: null }), {
    value: 'ENV',
    source: 'env',
  });
  assert.deepEqual(
    resolveByPrecedence({ kind: 'main', site: null, global: null, env: null, descriptor: d({ default: 'DEF' }) }),
    { value: 'DEF', source: 'default' },
  );
});

test('un default declarado como null es no declarar default', () => {
  assert.deepEqual(resolveByPrecedence({ kind: 'main', descriptor: d({ default: null }) }), {
    value: undefined,
    source: 'unset',
  });
});

test('false, 0 y "" SON valores y ganan: apagar un flag por tienda es el caso normal', () => {
  assert.deepEqual(resolveByPrecedence({ kind: 'main', site: false, global: true }), {
    value: false,
    source: 'site',
  });
  assert.deepEqual(resolveByPrecedence({ kind: 'main', site: 0, global: 99 }), {
    value: 0,
    source: 'site',
  });
  assert.deepEqual(resolveByPrecedence({ kind: 'main', site: '', global: 'algo' }), {
    value: '',
    source: 'site',
  });
  assert.deepEqual(resolveByPrecedence({ kind: 'secondary', site: false }), {
    value: false,
    source: 'site',
  });
});

// ─── SiteResolution → SiteKind: las cinco variantes ──────────────────────────

test('siteKindOf: site con is_main true → main', () => {
  assert.equal(siteKindOf({ status: 'site', site: ref(true) }), 'main');
});

test('siteKindOf: site con is_main false → secondary', () => {
  assert.equal(siteKindOf({ status: 'site', site: ref(false) }), 'secondary');
});

test('siteKindOf: singleSite → none, NO main (se lee de la global, que es donde escribe el admin)', () => {
  // `resolve-site.ts:150` devuelve singleSite antes del fallback a la principal, así
  // que en un proyecto de una sola tienda TODA request cae acá. Mapearlo a 'main'
  // haría leer la fila de la tienda mientras el admin escribe en la global.
  assert.equal(siteKindOf({ status: 'singleSite', site: ref(true) }), 'none');
  // Y tampoco cambia si esa única tienda no está marcada como principal.
  assert.equal(siteKindOf({ status: 'singleSite', site: ref(false) }), 'none');
});

test('siteKindOf: allSites → none (en el admin "sin tienda" significa todas)', () => {
  assert.equal(siteKindOf({ status: 'allSites' }), 'none');
});

test('siteKindOf: registryAbsent → none, en las tres razones', () => {
  for (const reason of ['module', 'table', 'empty'] as const) {
    assert.equal(siteKindOf({ status: 'registryAbsent', reason }), 'none');
  }
});

test('siteKindOf: unknownSite → secondary (un id stale NO lee la global)', () => {
  assert.equal(siteKindOf({ status: 'unknownSite', hint: { slug: 'borrada' } }), 'secondary');
});

// ─── Integración de las dos funciones ────────────────────────────────────────

test('resolveForSite: un id stale resuelve off aunque haya global y env cargados', () => {
  // Segunda línea de defensa: el guard de request tiene que tirar
  // (UNKNOWN_SITE_ERROR_CODE). Si alguien se olvida de llamarlo, esto no filtra.
  const stale: SiteResolution = { status: 'unknownSite', hint: { siteId: 'demo_borrada' } };
  assert.deepEqual(resolveForSite(stale, { global: 'GLOBAL', env: 'ENV' }), {
    value: undefined,
    source: 'off',
  });
});

test('resolveForSite: las tres reglas, entrando por la resolución de la request', () => {
  const layers = { site: 'SITE', global: 'GLOBAL', env: 'ENV' };
  assert.equal(resolveForSite({ status: 'site', site: ref(true) }, layers).source, 'site');
  assert.equal(
    resolveForSite({ status: 'site', site: ref(false) }, { ...layers, site: undefined }).source,
    'off',
  );
  assert.equal(resolveForSite({ status: 'allSites' }, layers).source, 'global');
});
