import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { MedusaContainer } from '@medusajs/framework/types';
import type { SettingDescriptor, SettingScope } from './descriptors/types';
import type { SiteRef, SiteResolution } from '../../lib/multistore/types';
import { invalidateAllNamespaces } from '../../lib/settings-cache';
import type { SiteScopeId, SiteSettingsStoreLike } from './site-setting-store';
import {
  applyPlan,
  getNamespaceRows,
  getStates,
  resolveSettingFor,
  siteScopeIdOf,
} from './service';

/**
 * Lo que se testea acá es EL CABLEADO, que es donde vive el riesgo que ni
 * `precedence.test.ts` (puro, sin filas) ni `site-setting-store.test.ts` (filas,
 * sin precedencia) pueden ver:
 *
 *  - que la capa `site` NO se rellene con la global cuando no hay tienda,
 *  - que el plan se PARTA por `scope` de descriptor,
 *  - que la cache no sirva el jsonb de una tienda a otra.
 *
 * Los tres se ven idénticos a código correcto cuando están mal, y los tres son
 * cross-tenant.
 */

const NS = 'extension:typesense';

type FakeRow = { site_id: SiteScopeId; namespace: string; value: Record<string, unknown> };

class FakeStore implements SiteSettingsStoreLike {
  rows: FakeRow[] = [];
  revisions = new Map<string, number>();
  reads = 0;

  private slot = (namespace: string, siteId: SiteScopeId) => `${siteId ?? '~global'}|${namespace}`;

  seed(siteId: SiteScopeId, value: Record<string, unknown>, revision = 1) {
    this.rows.push({ site_id: siteId, namespace: NS, value });
    this.revisions.set(this.slot(NS, siteId), revision);
  }

  row(siteId: SiteScopeId) {
    return this.rows.find((r) => r.site_id === siteId && r.namespace === NS);
  }

  async getSiteSetting(namespace: string, siteId: SiteScopeId = null) {
    this.reads++;
    const row = this.rows.find((r) => r.site_id === siteId && r.namespace === namespace);
    return {
      namespace,
      site_id: siteId,
      revision: this.revisions.get(this.slot(namespace, siteId)) ?? 0,
      value: (row?.value ?? {}) as Record<string, unknown>,
    };
  }

  async listSiteSettings(filter: { namespace: string; site_id: SiteScopeId }) {
    return this.rows
      .filter((r) => r.namespace === filter.namespace && r.site_id === filter.site_id)
      .map((r) => ({ id: `sset_${r.site_id ?? 'global'}` }));
  }

  async upsertSiteSetting(input: {
    namespace: string;
    value: Record<string, unknown>;
    siteId?: SiteScopeId;
    expectedRevision?: number;
  }) {
    const siteId = input.siteId ?? null;
    const slot = this.slot(input.namespace, siteId);
    const revision = (this.revisions.get(slot) ?? 0) + 1;
    this.revisions.set(slot, revision);
    const row = this.rows.find((r) => r.site_id === siteId && r.namespace === input.namespace);
    if (row) row.value = input.value;
    else this.rows.push({ site_id: siteId, namespace: input.namespace, value: input.value });
    return { namespace: input.namespace, site_id: siteId, revision, value: input.value };
  }
}

const containerOf = (store: FakeStore): MedusaContainer =>
  ({ resolve: () => store }) as unknown as MedusaContainer;

const entry = (value: unknown) => ({
  value,
  ciphertext: null,
  is_secret: false,
  updated_at: '2026-01-01T00:00:00.000Z',
  updated_by: 'user_1',
});

const d = (key: string, scope: SettingScope = 'site'): SettingDescriptor => ({
  key,
  namespace: NS,
  env: [`__NO_EXISTE_${key}`],
  type: 'string',
  tier: 'runtime',
  scope,
  group: 'g',
  label: key,
});

const siteRef = (over: Partial<SiteRef> = {}): SiteRef => ({
  id: 'demo_a',
  slug: 'a',
  name: 'A',
  is_main: false,
  channel_ids: [],
  region_id: null,
  stock_location_id: null,
  ...over,
});

const MAIN: SiteResolution = { status: 'site', site: siteRef({ id: 'demo_main', is_main: true }) };
const SECONDARY: SiteResolution = { status: 'site', site: siteRef({ id: 'demo_b' }) };
const ALL_SITES: SiteResolution = { status: 'allSites' };
const UNKNOWN: SiteResolution = { status: 'unknownSite', hint: { siteId: 'demo_borrada' } };

const okPlan = (writes: { key: string; value: unknown }[] = [], deletes: string[] = []) => ({
  ok: true as const,
  writes: writes.map((w) => ({ ...w, isSecret: false })),
  deletes,
});

beforeEach(() => invalidateAllNamespaces());

/* -------------------------------------------------------------------------- */
/* Lectura                                                                     */
/* -------------------------------------------------------------------------- */

test('sin tienda, la capa `site` NO se rellena con la global', async () => {
  // Con `siteId === null` el store devuelve la global en las dos puntas. Si se
  // pasara también como capa de tienda, `unknownSite` —que fail-cierra como
  // secundaria— leería la global con origen `site`. Ese es el fail-open.
  const store = new FakeStore();
  store.seed(null, { HOST: entry('global.local') });

  const scopes = await getNamespaceRows(containerOf(store), NS, null);
  assert.equal(scopes.own, scopes.global);

  const value = await resolveSettingFor(containerOf(store), d('HOST'), UNKNOWN);
  assert.equal(value, undefined, 'una tienda desconocida no puede leer la global');
});

test('la principal hereda de la global y la secundaria queda apagada', async () => {
  const store = new FakeStore();
  store.seed(null, { HOST: entry('global.local') });

  const main = await getStates(containerOf(store), [d('HOST')], MAIN);
  assert.equal(main[0]?.source, 'global');
  assert.equal(main[0]?.is_set, false, 'la principal todavía no forkeó');

  const secondary = await getStates(containerOf(store), [d('HOST')], SECONDARY);
  assert.equal(secondary[0]?.source, 'off');
});

test('un descriptor `instance` se lee de la global aun desde una secundaria', async () => {
  const store = new FakeStore();
  store.seed(null, { HOST: entry('global.local') });
  store.seed('demo_b', {});

  const states = await getStates(containerOf(store), [d('HOST', 'instance')], SECONDARY);
  assert.equal(states[0]?.source, 'global');
  assert.equal(states[0]?.is_set, true, 'la capa editable de un `instance` es la global');
});

test('la cache es POR TIENDA: la tienda B no ve el jsonb de la A', async () => {
  const store = new FakeStore();
  store.seed(null, { HOST: entry('global.local') });
  store.seed('demo_a', { HOST: entry('a.local') });
  store.seed('demo_b', { HOST: entry('b.local') });

  const container = containerOf(store);
  const a: SiteResolution = { status: 'site', site: siteRef({ id: 'demo_a' }) };
  const b: SiteResolution = { status: 'site', site: siteRef({ id: 'demo_b' }) };

  assert.equal(await resolveSettingFor(container, d('HOST'), a), 'a.local');
  assert.equal(await resolveSettingFor(container, d('HOST'), b), 'b.local');
  // Y la segunda lectura de A sigue siendo A, no lo último cacheado.
  assert.equal(await resolveSettingFor(container, d('HOST'), a), 'a.local');
});

test('la segunda lectura del mismo scope no vuelve a la base', async () => {
  const store = new FakeStore();
  store.seed(null, { HOST: entry('global.local') });
  const container = containerOf(store);

  await resolveSettingFor(container, d('HOST'), ALL_SITES);
  const afterFirst = store.reads;
  await resolveSettingFor(container, d('HOST'), ALL_SITES);
  assert.equal(store.reads, afterFirst, 'la memoización no está tomando');
});

/* -------------------------------------------------------------------------- */
/* Escritura                                                                   */
/* -------------------------------------------------------------------------- */

test('escribir con tienda activa crea SU fila y no toca la global', async () => {
  const store = new FakeStore();
  store.seed(null, { HOST: entry('global.local') });

  const result = await applyPlan(containerOf(store), {
    namespace: NS,
    descriptors: [d('HOST')],
    plan: okPlan([{ key: 'HOST', value: 'a.local' }]),
    actorId: 'user_1',
    resolution: { status: 'site', site: siteRef({ id: 'demo_a' }) },
  });

  assert.equal(result.scopes.length, 1);
  assert.equal(result.scopes[0]?.site_id, 'demo_a');
  assert.equal(result.scopes[0]?.seeded_from_global, true);
  assert.equal((store.row('demo_a')?.value.HOST as { value: string }).value, 'a.local');
  assert.equal((store.row(null)?.value.HOST as { value: string }).value, 'global.local');
});

test('el plan se PARTE por scope: lo de instancia va SIEMPRE a la global', async () => {
  // Sin el split, un ajuste declarado de instancia se volvería de tienda en
  // silencio y el síntoma sería "en la tienda B anda distinto", sin error.
  const store = new FakeStore();
  store.seed(null, {});

  const result = await applyPlan(containerOf(store), {
    namespace: NS,
    descriptors: [d('HOST', 'site'), d('COLLECTION', 'instance')],
    plan: okPlan([
      { key: 'HOST', value: 'a.local' },
      { key: 'COLLECTION', value: 'products' },
    ]),
    actorId: 'user_1',
    resolution: { status: 'site', site: siteRef({ id: 'demo_a' }) },
  });

  assert.deepEqual(
    new Set(result.scopes.map((s) => s.site_id)),
    new Set([null, 'demo_a']),
    'tendría que haber escrito las dos filas',
  );
  assert.equal((store.row('demo_a')?.value.HOST as { value: string }).value, 'a.local');
  assert.equal(store.row('demo_a')?.value.COLLECTION, undefined);
  assert.equal((store.row(null)?.value.COLLECTION as { value: string }).value, 'products');
});

test('sin tienda activa, todo va a la global en UNA sola escritura', async () => {
  const store = new FakeStore();
  store.seed(null, {});

  const result = await applyPlan(containerOf(store), {
    namespace: NS,
    descriptors: [d('HOST', 'site'), d('COLLECTION', 'instance')],
    plan: okPlan([
      { key: 'HOST', value: 'h' },
      { key: 'COLLECTION', value: 'c' },
    ]),
    actorId: 'user_1',
    resolution: ALL_SITES,
  });

  assert.equal(result.scopes.length, 1);
  assert.equal(result.scopes[0]?.site_id, null);
});

test('una tienda desconocida NO puede escribir la configuración de la instancia', async () => {
  const store = new FakeStore();
  store.seed(null, { HOST: entry('global.local') });

  await assert.rejects(
    () =>
      applyPlan(containerOf(store), {
        namespace: NS,
        descriptors: [d('HOST')],
        plan: okPlan([{ key: 'HOST', value: 'pisado' }]),
        actorId: 'user_1',
        resolution: UNKNOWN,
      }),
    /MULTISTORE_UNKNOWN_SITE/,
  );
  assert.equal((store.row(null)?.value.HOST as { value: string }).value, 'global.local');
});

test('guardar invalida la cache de TODOS los scopes del namespace', async () => {
  const store = new FakeStore();
  store.seed(null, { HOST: entry('global.local') });
  const container = containerOf(store);

  // Deja cacheada la vista de la instancia…
  assert.equal(await resolveSettingFor(container, d('HOST'), ALL_SITES), 'global.local');

  // …y guardá desde una TIENDA, que escribe otra fila (y también podría escribir
  // la global si hubiera claves de instancia).
  await applyPlan(container, {
    namespace: NS,
    descriptors: [d('HOST', 'instance')],
    plan: okPlan([{ key: 'HOST', value: 'nuevo.local' }]),
    actorId: 'user_1',
    resolution: { status: 'site', site: siteRef({ id: 'demo_a' }) },
  });

  assert.equal(await resolveSettingFor(container, d('HOST'), ALL_SITES), 'nuevo.local');
});

/* -------------------------------------------------------------------------- */
/* `siteScopeIdOf` es la contraparte de `siteKindOf`                           */
/* -------------------------------------------------------------------------- */

test('siteScopeIdOf: sólo una tienda concreta tiene fila propia', () => {
  assert.equal(siteScopeIdOf(MAIN), 'demo_main');
  assert.equal(siteScopeIdOf(SECONDARY), 'demo_b');
  assert.equal(siteScopeIdOf(ALL_SITES), null);
  assert.equal(siteScopeIdOf({ status: 'singleSite', site: siteRef() }), null);
  assert.equal(siteScopeIdOf({ status: 'registryAbsent', reason: 'module' }), null);
  assert.equal(siteScopeIdOf(undefined), null);
});
