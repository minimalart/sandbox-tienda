import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveSite, listSites, toSiteRef } from './resolve-site';
import { resolveSiteViaSql } from './resolve-site-sql';
import { SITE_REGISTRY_MODULE } from './module-key';

/**
 * Los dos caminos de resolución —container y SQL— tienen que dar el mismo `SiteRef`.
 * El gemelo SQL existe porque los providers reciben un container aislado; si los dos
 * driftean, el filtrado del admin y el de un provider de fulfillment discrepan y el
 * síntoma es "a veces filtra".
 */

type Row = {
  id: string; slug: string; name: string; is_main: boolean;
  sales_channel_id: string | null; b2b_sales_channel_id: string | null;
  region_id: string | null; stock_location_id: string | null;
  deleted_at?: string | null;
};

const row = (over: Partial<Row> & { id: string; slug: string }): Row => ({
  name: over.slug, is_main: false,
  sales_channel_id: null, b2b_sales_channel_id: null,
  region_id: null, stock_location_id: null, deleted_at: null,
  ...over,
});

const NORTE = row({ id: 'demo_norte', slug: 'norte', sales_channel_id: 'sc_norte', b2b_sales_channel_id: 'sc_norte_b2b', region_id: 'reg_1' });
const SUR = row({ id: 'demo_sur', slug: 'sur', sales_channel_id: 'sc_sur' });
const MAIN = row({ id: 'demo_main', slug: 'principal', is_main: true, sales_channel_id: 'sc_default' });

/** Evalúa los filtros que produce `resolveSite` sobre un set de filas en memoria. */
function matches(candidate: Row, filters: Record<string, any>): boolean {
  if (filters.$or) return filters.$or.some((f: any) => matches(candidate, f));
  return Object.entries(filters).every(([key, value]) => (candidate as any)[key] === value);
}

function fakeContainer(rows: Row[], opts: { module?: boolean; error?: unknown } = {}) {
  const service = {
    listDemoStores: async (filters: Record<string, any> = {}, config: Record<string, any> = {}) => {
      if (opts.error) throw opts.error;
      const live = rows.filter((r) => !r.deleted_at);
      const found = Object.keys(filters).length === 0 ? live : live.filter((r) => matches(r, filters));
      return typeof config.take === 'number' ? found.slice(0, config.take) : found;
    },
  };
  return {
    resolve: (key: string) => {
      if (opts.module === false) throw new Error('module not registered');
      if (key === SITE_REGISTRY_MODULE) return service;
      throw new Error(`unexpected resolve: ${key}`);
    },
  } as any;
}

/** Fake de knex que entiende las tres queries de `resolve-site-sql.ts`. */
function fakePg(rows: Row[], opts: { error?: unknown } = {}) {
  return {
    raw: async (sql: string, bindings: unknown[] = []) => {
      if (opts.error) throw opts.error;
      const live = rows.filter((r) => !r.deleted_at);
      if (sql.includes('"id" = ?')) return { rows: live.filter((r) => r.id === bindings[0]).slice(0, 1) };
      if (sql.includes('"slug" = ?')) return { rows: live.filter((r) => r.slug === bindings[0]).slice(0, 1) };
      if (sql.includes('"sales_channel_id" = ?')) {
        return { rows: live.filter((r) => r.sales_channel_id === bindings[0] || r.b2b_sales_channel_id === bindings[1]).slice(0, 1) };
      }
      if (sql.includes('"is_main" = true')) return { rows: live.filter((r) => r.is_main).slice(0, 1) };
      return { rows: live.slice(0, 2) };
    },
  };
}

test('resuelve por site_id', async () => {
  const r = await resolveSite(fakeContainer([NORTE, SUR]), { siteId: 'demo_norte' });
  assert.equal(r.status, 'site');
  assert.equal(r.status === 'site' && r.site.slug, 'norte');
});

test('resuelve por slug', async () => {
  const r = await resolveSite(fakeContainer([NORTE, SUR]), { slug: 'sur' });
  assert.equal(r.status === 'site' && r.site.id, 'demo_sur');
});

test('resuelve por el canal principal', async () => {
  const r = await resolveSite(fakeContainer([NORTE, SUR]), { salesChannelId: 'sc_norte' });
  assert.equal(r.status === 'site' && r.site.id, 'demo_norte');
});

test('BUG B2B: el canal mayorista resuelve a SU tienda, no al global', async () => {
  // Una tienda con b2b_enabled tiene DOS canales. `recurring-order/runtime-config.ts`
  // filtra sólo por `sales_channel_id`, así que hoy una request que llega por el canal
  // mayorista NO matchea su tienda y cae a la config global SIN ningún error.
  const r = await resolveSite(fakeContainer([NORTE, SUR, MAIN]), { salesChannelId: 'sc_norte_b2b' });
  assert.equal(r.status, 'site', 'el canal mayorista tiene que resolver a una tienda');
  assert.equal(r.status === 'site' && r.site.id, 'demo_norte');
});

test('channel_ids trae los dos canales, sin nulls ni duplicados', () => {
  assert.deepEqual(toSiteRef(NORTE).channel_ids, ['sc_norte', 'sc_norte_b2b']);
  assert.deepEqual(toSiteRef(SUR).channel_ids, ['sc_sur']);
  const same = row({ id: 'x', slug: 'x', sales_channel_id: 'sc_a', b2b_sales_channel_id: 'sc_a' });
  assert.deepEqual(toSiteRef(same).channel_ids, ['sc_a'], 'no duplica si los dos canales coinciden');
});

test('una tienda pedida que no existe es unknownSite, NO allSites', async () => {
  // Degradar a allSites acá es el bug caro: el operador cree que ve su tienda y ve todo,
  // y una escritura desde esa pantalla pega en la fila de otra.
  const r = await resolveSite(fakeContainer([NORTE, SUR]), { siteId: 'demo_borrada' });
  assert.equal(r.status, 'unknownSite');
});

test('una tienda soft-deleted cuenta como inexistente', async () => {
  const gone = row({ id: 'demo_gone', slug: 'gone', deleted_at: '2026-01-01' });
  const r = await resolveSite(fakeContainer([NORTE, SUR, gone]), { siteId: 'demo_gone' });
  assert.equal(r.status, 'unknownSite');
});

test('sin módulo → registryAbsent(module)', async () => {
  const r = await resolveSite(fakeContainer([], { module: false }), { siteId: 'demo_x' });
  assert.deepEqual(r, { status: 'registryAbsent', reason: 'module' });
});

test('sin tabla (42P01) → registryAbsent(table)', async () => {
  const err = Object.assign(new Error('relation "demo_store" does not exist'), { code: '42P01' });
  const r = await resolveSite(fakeContainer([], { error: err }), { siteId: 'demo_x' });
  assert.deepEqual(r, { status: 'registryAbsent', reason: 'table' });
});

test('registro vacío → registryAbsent(empty)', async () => {
  const r = await resolveSite(fakeContainer([]), {});
  assert.deepEqual(r, { status: 'registryAbsent', reason: 'empty' });
});

test('una sola tienda → singleSite (no filtra)', async () => {
  // Con una sola tienda no hay nada que aislar, y filtrar por sus canales escondería
  // filas cuyo canal se creó a mano.
  const r = await resolveSite(fakeContainer([MAIN]), {});
  assert.equal(r.status, 'singleSite');
});

test('sin pistas y varias tiendas → allSites (el default del admin)', async () => {
  const r = await resolveSite(fakeContainer([NORTE, SUR, MAIN]), {});
  assert.deepEqual(r, { status: 'allSites' });
});

test('allowMainFallback cae a la principal; sin él, no', async () => {
  const con = fakeContainer([NORTE, SUR, MAIN]);
  const withFallback = await resolveSite(con, { allowMainFallback: true });
  assert.equal(withFallback.status === 'site' && withFallback.site.is_main, true);
  const without = await resolveSite(con, {});
  assert.equal(without.status, 'allSites');
});

test('listSites puede excluir la principal', async () => {
  const con = fakeContainer([NORTE, SUR, MAIN]);
  assert.equal((await listSites(con)).length, 3);
  assert.deepEqual((await listSites(con, { includeMain: false })).map((s) => s.id), ['demo_norte', 'demo_sur']);
});

test('paridad: container y SQL dan el mismo SiteRef', async () => {
  const rows = [NORTE, SUR, MAIN];
  for (const hint of [
    { siteId: 'demo_norte' },
    { slug: 'sur' },
    { salesChannelId: 'sc_norte_b2b' },
    { siteId: 'demo_inexistente' },
    {},
    { allowMainFallback: true },
  ]) {
    const viaContainer = await resolveSite(fakeContainer(rows), hint);
    const viaSql = await resolveSiteViaSql(fakePg(rows), hint);
    assert.deepEqual(viaSql, viaContainer, `divergen para ${JSON.stringify(hint)}`);
  }
});

test('paridad: sin conexión y sin tabla', async () => {
  assert.deepEqual(await resolveSiteViaSql(undefined, {}), { status: 'registryAbsent', reason: 'module' });
  const err = Object.assign(new Error('nope'), { code: '42P01' });
  assert.deepEqual(await resolveSiteViaSql(fakePg([], { error: err }), {}), { status: 'registryAbsent', reason: 'table' });
});
