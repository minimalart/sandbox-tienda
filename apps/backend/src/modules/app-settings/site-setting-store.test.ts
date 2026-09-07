import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MedusaContainer } from '@medusajs/framework/types';
import {
  applyPlanForSite,
  classifyRevisionConflict,
  isRevisionConflict,
  mergeNamespaceBlob,
  readEntriesFromBlob,
  type SiteScopeId,
  type SiteSettingsStoreLike,
} from './site-setting-store';
import type { PlannedWrite } from './write-plan';

const NS = 'extension:typesense';
const AT = new Date('2026-01-01T00:00:00.000Z');
const ISO = AT.toISOString();

/**
 * Cifrado falso pero DETERMINISTA: `encryptSecret` usa IV aleatorio y un test no
 * podría afirmar nada sobre su salida. Va en base64 y no `enc:${plain}` para que el
 * test que exige que el claro no aparezca en el JSON no se apruebe solo.
 */
const encrypt = (plain: string) => `v1:${Buffer.from(plain).toString('base64')}`;

const w = (key: string, value: unknown, isSecret = false): PlannedWrite => ({
  key,
  value,
  isSecret,
});

const entry = (value: unknown, extra: Record<string, unknown> = {}) => ({
  value,
  ciphertext: null,
  is_secret: false,
  updated_at: '2025-12-01T00:00:00.000Z',
  updated_by: 'user_viejo',
  ...extra,
});

const merge = (base: unknown, writes: PlannedWrite[] = [], deletes: string[] = []) =>
  mergeNamespaceBlob({ base, writes, deletes, actorId: 'user_1', now: AT, encrypt });

/* -------------------------------------------------------------------------- */
/* El merge puro                                                               */
/* -------------------------------------------------------------------------- */

test('escribir una clave conserva las otras del namespace', () => {
  const base = { HOST: entry('viejo.local'), PORT: entry(8108), ENABLED: entry(true) };
  const next = merge(base, [w('HOST', 'nuevo.local')]);

  assert.deepEqual(Object.keys(next).sort(), ['ENABLED', 'HOST', 'PORT']);
  assert.deepEqual(next.HOST, {
    value: 'nuevo.local',
    ciphertext: null,
    is_secret: false,
    updated_at: ISO,
    updated_by: 'user_1',
  });
  // Las no tocadas quedan IDÉNTICAS, incluido su `updated_at`: no las escribió nadie.
  assert.deepEqual(next.PORT, base.PORT);
  assert.deepEqual(next.ENABLED, base.ENABLED);
});

test('el merge NO muta la base: la global que se copia queda intacta en memoria', () => {
  const base = { HOST: entry('viejo.local') };
  const snapshot = structuredClone(base);
  merge(base, [w('HOST', 'nuevo.local')], []);
  assert.deepEqual(base, snapshot);
});

test('borrar es por NOMBRE de clave y no toca a las demás', () => {
  const base = { HOST: entry('h'), API_KEY: entry(null, { is_secret: true, ciphertext: 'v1:x' }) };
  const next = merge(base, [], ['API_KEY']);

  assert.deepEqual(Object.keys(next), ['HOST']);
  assert.equal(Object.hasOwn(next, 'API_KEY'), false);
});

test('borrar la última clave deja el namespace VACÍO, no roto', () => {
  const next = merge({ HOST: entry('h') }, [], ['HOST']);
  assert.deepEqual(next, {});
  // `getSiteSetting` devuelve `value ?? {}`: vacío e inexistente se leen igual.
  assert.deepEqual(readEntriesFromBlob(next).size, 0);
});

test('borrar una clave que no está es un no-op, no un error', () => {
  const next = merge({ HOST: entry('h') }, [], ['NO_ESTABA']);
  assert.deepEqual(Object.keys(next), ['HOST']);
});

test('un secreto guarda ciphertext y NUNCA el claro', () => {
  const next = merge({}, [w('API_KEY', 'xyz-secreto', true)]);
  assert.deepEqual(next.API_KEY, {
    value: null,
    ciphertext: encrypt('xyz-secreto'),
    is_secret: true,
    updated_at: ISO,
    updated_by: 'user_1',
  });
  assert.equal(JSON.stringify(next).includes('xyz-secreto'), false);
});

test('el merge preserva claves ajenas: no barre config de otro dueño del namespace', () => {
  // Caso vivo: `extension:fiscal-documentation` guarda `{ cuit, punto_venta }` planos.
  const base = { cuit: '30-11111111-9', punto_venta: 3, HOST: entry('h') };
  const next = merge(base, [w('HOST', 'h2')]);

  assert.equal(next.cuit, '30-11111111-9');
  assert.equal(next.punto_venta, 3);
});

test('una base que no es un objeto no rompe el merge: arranca vacía', () => {
  assert.deepEqual(merge(null, [w('HOST', 'h')]), {
    HOST: { value: 'h', ciphertext: null, is_secret: false, updated_at: ISO, updated_by: 'user_1' },
  });
  assert.deepEqual(Object.keys(merge([1, 2, 3], [w('HOST', 'h')])), ['HOST']);
});

test('undefined se guarda como null: la clave sigue existiendo', () => {
  const next = merge({}, [w('HOST', undefined)]) as Record<string, { value: unknown }>;
  assert.equal(Object.hasOwn(next, 'HOST'), true);
  assert.equal(next.HOST.value, null);
});

/* -------------------------------------------------------------------------- */
/* Lectura del JSON                                                            */
/* -------------------------------------------------------------------------- */

test('readEntriesFromBlob saltea lo que no tiene forma de sobre', () => {
  const rows = readEntriesFromBlob({
    HOST: entry('h'),
    cuit: '30-11111111-9',
    RARO: { value: 'x' }, // sin `is_secret`: no es nuestro
  });

  assert.deepEqual([...rows.keys()], ['HOST']);
  // Un plano no se devuelve como valor: sin `is_secret` un secreto saldría en claro.
  assert.equal(rows.has('cuit'), false);
  assert.equal(rows.has('RARO'), false);
});

test('readEntriesFromBlob devuelve filas con la forma de AppSettingRow', () => {
  const rows = readEntriesFromBlob({
    API_KEY: entry(null, { is_secret: true, ciphertext: 'v1:x' }),
  });
  assert.deepEqual(rows.get('API_KEY'), {
    key: 'API_KEY',
    value: null,
    ciphertext: 'v1:x',
    is_secret: true,
    updated_at: '2025-12-01T00:00:00.000Z',
    updated_by: 'user_viejo',
  });
});

/* -------------------------------------------------------------------------- */
/* Clasificación de la carrera                                                 */
/* -------------------------------------------------------------------------- */

test('una carrera sobre OTRA clave es disjunta', () => {
  const before = { HOST: entry('h') };
  const after = { HOST: entry('h'), PORT: entry(8108) };
  assert.equal(classifyRevisionConflict(before, after, ['HOST']), 'disjoint');
});

test('una carrera sobre LA MISMA clave es superpuesta', () => {
  const before = { HOST: entry('h') };
  const after = { HOST: entry('otro') };
  assert.equal(classifyRevisionConflict(before, after, ['HOST']), 'overlapping');
});

test('el orden de las propiedades del sobre no inventa un conflicto', () => {
  const before = { HOST: { value: 'h', is_secret: false, ciphertext: null } };
  const after = { HOST: { ciphertext: null, is_secret: false, value: 'h' } };
  assert.equal(classifyRevisionConflict(before, after, ['HOST']), 'disjoint');
});

test('que el otro haya CREADO nuestra clave también es superpuesto', () => {
  assert.equal(classifyRevisionConflict({}, { HOST: entry('h') }, ['HOST']), 'overlapping');
});

test('isRevisionConflict reconoce los dos caminos de la carrera', () => {
  assert.equal(
    isRevisionConflict(new Error('Conflicto de revisión en "x": esperaba 1, actual 2.')),
    true
  );
  assert.equal(
    isRevisionConflict(
      Object.assign(new Error('duplicate key value violates unique constraint'), {
        code: '23505',
        constraint: 'IDX_site_setting_revision_site_ns_rev',
      })
    ),
    true
  );
  assert.equal(isRevisionConflict(new Error('connection terminated')), false);
  assert.equal(
    isRevisionConflict(
      Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'IDX_product_handle' })
    ),
    false
  );
});

/* -------------------------------------------------------------------------- */
/* applyPlanForSite, contra un store falso en memoria                          */
/* -------------------------------------------------------------------------- */

type FakeRow = { site_id: SiteScopeId; namespace: string; value: Record<string, unknown> };

class FakeStore implements SiteSettingsStoreLike {
  rows: FakeRow[] = [];
  revisions = new Map<string, number>();
  upserts: { namespace: string; siteId: SiteScopeId; expectedRevision?: number }[] = [];
  /** Simula al otro writer: corre DENTRO del upsert, antes del chequeo de revisión. */
  race: ((attempt: number) => void) | null = null;
  private attempt = 0;

  private slot = (namespace: string, siteId: SiteScopeId) => `${siteId ?? '~global'}|${namespace}`;

  seed(siteId: SiteScopeId, namespace: string, value: Record<string, unknown>, revision = 1) {
    this.rows.push({ site_id: siteId, namespace, value });
    this.revisions.set(this.slot(namespace, siteId), revision);
  }

  row(siteId: SiteScopeId, namespace = NS) {
    return this.rows.find((r) => r.site_id === siteId && r.namespace === namespace);
  }

  async getSiteSetting(namespace: string, siteId: SiteScopeId = null) {
    const row = this.row(siteId, namespace);
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
    actorId?: string | null;
    note?: string | null;
  }) {
    const siteId = input.siteId ?? null;
    this.upserts.push({
      namespace: input.namespace,
      siteId,
      expectedRevision: input.expectedRevision,
    });
    this.race?.(++this.attempt);

    const slot = this.slot(input.namespace, siteId);
    const current = this.revisions.get(slot) ?? 0;
    if (input.expectedRevision !== undefined && input.expectedRevision !== current) {
      throw new Error(
        `Conflicto de revisión en "${input.namespace}": esperaba ${input.expectedRevision}, actual ${current}.`
      );
    }

    const revision = current + 1;
    this.revisions.set(slot, revision);
    const row = this.row(siteId, input.namespace);
    if (row) row.value = input.value;
    else this.rows.push({ site_id: siteId, namespace: input.namespace, value: input.value });
    return { namespace: input.namespace, site_id: siteId, revision, value: input.value };
  }
}

const containerOf = (store: FakeStore): MedusaContainer =>
  ({ resolve: () => store }) as unknown as MedusaContainer;

const apply = (
  store: FakeStore,
  siteId: SiteScopeId,
  writes: PlannedWrite[],
  deletes: string[] = []
) =>
  applyPlanForSite(containerOf(store), {
    namespace: NS,
    siteId,
    plan: { writes, deletes },
    actorId: 'user_1',
    now: () => AT,
    encrypt,
  });

test('la tienda SIN fila propia parte del JSON global y NO toca la global', async () => {
  const store = new FakeStore();
  store.seed(null, NS, { HOST: entry('global.local'), PORT: entry(8108) }, 12);

  const result = await apply(store, 'site_a', [w('HOST', 'a.local')]);

  assert.equal(result.seeded_from_global, true);
  assert.equal(result.site_id, 'site_a');

  // La fila de la tienda se CREÓ, con lo heredado más el cambio.
  const own = store.row('site_a');
  assert.ok(own, 'tendría que existir la fila de la tienda');
  assert.equal((own.value.HOST as { value: string }).value, 'a.local');
  assert.deepEqual(own.value.PORT, { ...entry(8108) });

  // La global quedó EXACTAMENTE como estaba. Es la regla que ya se pagó tres veces.
  assert.deepEqual(store.row(null)?.value, { HOST: entry('global.local'), PORT: entry(8108) });
  assert.equal(store.revisions.get('~global|' + NS), 12);

  // Y el upsert fue con `siteId`, nunca con el id de la fila que devolvió el GET.
  assert.deepEqual(store.upserts, [{ namespace: NS, siteId: 'site_a', expectedRevision: 0 }]);
});

test('una tienda con fila VACÍA no resucita las claves de la global', async () => {
  const store = new FakeStore();
  store.seed(null, NS, { HOST: entry('global.local') }, 3);
  store.seed('site_a', NS, {}, 4); // alguien borró todo a mano

  const result = await apply(store, 'site_a', [w('PORT', 8108)]);

  assert.equal(result.seeded_from_global, false);
  assert.deepEqual(Object.keys(store.row('site_a')!.value), ['PORT']);
});

test('con siteId null se escribe la global y no se inventa ninguna tienda', async () => {
  const store = new FakeStore();
  store.seed(null, NS, { HOST: entry('h') }, 1);

  const result = await apply(store, null, [w('PORT', 8108)]);

  assert.equal(result.seeded_from_global, false);
  assert.equal(result.revision, 2);
  assert.deepEqual(Object.keys(store.row(null)!.value).sort(), ['HOST', 'PORT']);
  assert.equal(store.rows.length, 1);
});

test('un plan vacío NO escribe: guardar sin cambios no forkea la tienda de la global', async () => {
  const store = new FakeStore();
  store.seed(null, NS, { HOST: entry('h') }, 1);

  const result = await apply(store, 'site_a', [], []);

  assert.equal(result.attempts, 0);
  assert.deepEqual(store.upserts, []);
  assert.equal(store.row('site_a'), undefined);
});

test('carrera DISJUNTA: se remergea sobre lo fresco y sobreviven las dos ediciones', async () => {
  const store = new FakeStore();
  store.seed('site_a', NS, { HOST: entry('h') }, 1);
  // El otro writer guarda PORT justo antes de que aterrice nuestro upsert.
  store.race = (attempt) => {
    if (attempt !== 1) return;
    store.row('site_a')!.value.PORT = entry(9999);
    store.revisions.set(`site_a|${NS}`, 2);
  };

  const result = await apply(store, 'site_a', [w('HOST', 'nuevo')]);

  assert.equal(result.attempts, 2);
  const value = store.row('site_a')!.value as Record<string, { value: unknown }>;
  assert.equal(value.HOST.value, 'nuevo');
  assert.equal(value.PORT.value, 9999, 'la edición del otro no se puede perder');
});

test('carrera SUPERPUESTA: 409 en vez de pisar la edición del otro', async () => {
  const store = new FakeStore();
  store.seed(
    'site_a',
    NS,
    { API_KEY: entry(null, { is_secret: true, ciphertext: 'enc:vieja' }) },
    1
  );
  store.race = (attempt) => {
    if (attempt !== 1) return;
    store.row('site_a')!.value.API_KEY = entry(null, {
      is_secret: true,
      ciphertext: 'enc:la-del-otro',
    });
    store.revisions.set(`site_a|${NS}`, 2);
  };

  await assert.rejects(
    () => apply(store, 'site_a', [w('API_KEY', 'la-mia', true)]),
    (error: Error & { type?: string }) => {
      assert.equal(error.type, 'conflict');
      assert.match(error.message, /API_KEY/);
      return true;
    }
  );

  // Y lo del otro sigue ahí: el 409 se tira ANTES del segundo upsert.
  const value = store.row('site_a')!.value as Record<string, { ciphertext: string }>;
  assert.equal(value.API_KEY.ciphertext, 'enc:la-del-otro');
  assert.equal(store.upserts.length, 1);
});

test('env import refuses an override created after planning', async () => {
  const store = new FakeStore();
  store.rows.push({
    site_id: null,
    namespace: NS,
    value: { HOST: { value: 'saved', is_secret: false } },
  });
  await assert.rejects(
    applyPlanForSite(containerOf(store), {
      namespace: NS,
      siteId: null,
      onlyMissing: true,
      plan: { writes: [{ key: 'HOST', value: 'old-env', isSecret: false }], deletes: [] },
    })
  );
  assert.equal((store.rows[0].value.HOST as { value: string }).value, 'saved');
});

test('sin el módulo de tiendas, escribir FALLA en vez de perderse en silencio', async () => {
  const container = {
    resolve: () => {
      throw new Error('no registrado');
    },
  } as unknown as MedusaContainer;

  await assert.rejects(
    () =>
      applyPlanForSite(container, {
        namespace: NS,
        siteId: 'site_a',
        plan: { writes: [w('HOST', 'h')], deletes: [] },
      }),
    /módulo de tiendas no está disponible/
  );
});
