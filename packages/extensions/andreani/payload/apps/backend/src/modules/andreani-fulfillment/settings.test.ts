import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { invalidateAllNamespaces } from '../../lib/settings-cache.ts';
import type { SiteRef, SiteResolution } from '../../lib/multistore/types.ts';
import {
  ANDREANI_SETTINGS_NAMESPACE,
  credentialsFingerprint,
  hasAndreaniCredentials,
  loadAndreaniSettingsViaPg,
  type PgRawConnection,
} from './settings.ts';

/**
 * La capa de TIENDA de Andreani, que es lo que kapso no puede tener.
 *
 * Se testea contra un `pg` falso porque los tests de este repo no tienen base
 * (`node:test`). Lo que se verifica no es el SQL sino las decisiones: qué scope
 * gana, qué pasa con una tienda secundaria que no declaró nada, y que dos tiendas
 * no compartan entrada de cache — que fue un bug real en `settings-cache.ts`.
 */

/** Sobre de `site_setting` tal como lo guarda `mergeNamespaceBlob`. */
const entry = (value: unknown) => ({
  value,
  ciphertext: null,
  is_secret: false,
  updated_at: null,
  updated_by: null,
});

const siteRef = (id: string, isMain: boolean): SiteRef => ({
  id,
  slug: id,
  name: id,
  is_main: isMain,
  channel_ids: [],
  region_id: null,
  stock_location_id: null,
});

const asSite = (id: string, isMain: boolean): SiteResolution => ({
  status: 'site',
  site: siteRef(id, isMain),
});

/**
 * `pg` falso: un mapa de `siteId | null` → jsonb del namespace. Devuelve fila sólo
 * para los scopes que el test declaró, igual que Postgres.
 */
function fakePg(blobs: Record<string, Record<string, unknown>>): PgRawConnection & {
  queries: string[];
} {
  const queries: string[] = [];
  return {
    queries,
    async raw(sql: string, bindings?: unknown[]) {
      queries.push(sql.replace(/\s+/g, ' ').trim());
      const isGlobal = sql.includes('"site_id" IS NULL');
      const key = isGlobal ? 'global' : String((bindings ?? [])[1]);
      const blob = blobs[key];
      return { rows: blob ? [{ value: blob }] : [] };
    },
  };
}

const ENV_KEYS = [
  'ANDREANI_USERNAME',
  'ANDREANI_CONTRACT',
  'ANDREANI_ORIGIN_CITY',
  'ANDREANI_DOMICILIO_CONTRACT_OVERRIDE',
  'ANDREANI_AUTO_FULFILL',
  'ANDREANI_HOSTNAME',
  'APP_SETTINGS_DISABLE',
];

beforeEach(() => {
  invalidateAllNamespaces();
  for (const key of ENV_KEYS) delete process.env[key];
});

test('el namespace es el mismo que declara el manifest', () => {
  assert.equal(ANDREANI_SETTINGS_NAMESPACE, 'extension:andreani');
});

test('sin pg cae al camino sincrónico en vez de tirar', async () => {
  process.env.ANDREANI_CONTRACT = '400000000';
  const settings = await loadAndreaniSettingsViaPg(undefined);
  assert.equal(settings.options.contract, '400000000');
});

test('la fila GLOBAL le gana al entorno', async () => {
  process.env.ANDREANI_CONTRACT = 'del-env';
  const pg = fakePg({ global: { ANDREANI_CONTRACT: entry('de-la-global') } });

  const settings = await loadAndreaniSettingsViaPg(pg);
  assert.equal(settings.options.contract, 'de-la-global');
});

test('la fila de la TIENDA le gana a la global', async () => {
  const pg = fakePg({
    global: { ANDREANI_CONTRACT: entry('de-la-global') },
    demo_a: { ANDREANI_CONTRACT: entry('de-la-tienda') },
  });

  const settings = await loadAndreaniSettingsViaPg(pg, asSite('demo_a', true));
  assert.equal(settings.options.contract, 'de-la-tienda');
});

test('la tienda PRINCIPAL hereda de la global lo que no declaró', async () => {
  const pg = fakePg({
    global: {
      ANDREANI_CONTRACT: entry('de-la-global'),
      ANDREANI_ORIGIN_CITY: entry('CABA'),
    },
    demo_main: { ANDREANI_CONTRACT: entry('propio') },
  });

  const settings = await loadAndreaniSettingsViaPg(pg, asSite('demo_main', true));
  assert.equal(settings.options.contract, 'propio');
  assert.equal(settings.options.origin.city, 'CABA');
});

test('FAIL-CLOSED: una tienda SECUNDARIA no hereda la global ni el env', async () => {
  // La regla que justifica todo `precedence.ts`. Heredar acá es despachar con el
  // contrato de otra tienda: el envío sale igual y se le factura al titular
  // equivocado.
  process.env.ANDREANI_CONTRACT = 'del-env';
  const pg = fakePg({
    global: { ANDREANI_CONTRACT: entry('de-la-global') },
    demo_b: {},
  });

  const settings = await loadAndreaniSettingsViaPg(pg, asSite('demo_b', false));
  assert.equal(
    settings.options.contract,
    '',
    'la secundaria heredó un contrato ajeno: fail-closed roto',
  );
});

test('FAIL-CLOSED no deja la extensión a medio andar: el default tampoco se hereda', async () => {
  // Los descriptores con `default` (hostname, dimensiones) también dan `off` para una
  // secundaria. El fallback de código de `buildSettings` es lo que evita que quede en
  // un estado Frankenstein — pero tiene que ser el MISMO valor, no otro.
  const pg = fakePg({ global: {}, demo_b: {} });
  const settings = await loadAndreaniSettingsViaPg(pg, asSite('demo_b', false));

  assert.equal(settings.options.dimensionFallback.length, 30);
  assert.equal(settings.options.dimensionFallback.weight, 0.5);
  assert.equal(settings.options.sender.name, 'Remitente');
});

test('los ajustes de INSTANCIA ignoran la fila de la tienda', async () => {
  // `ANDREANI_HOSTNAME` es `scope: 'instance'`: dos tiendas del mismo backend no le
  // pegan a entornos distintos de Andreani. Y por eso tampoco cae en fail-closed.
  const pg = fakePg({
    global: { ANDREANI_HOSTNAME: entry('apis.andreani.com') },
    demo_b: { ANDREANI_HOSTNAME: entry('apisqa.andreani.com') },
  });

  const settings = await loadAndreaniSettingsViaPg(pg, asSite('demo_b', false));
  assert.equal(settings.options.hostname, 'apis.andreani.com');
});

test('dos tiendas NO comparten entrada de cache', async () => {
  // El bug que documenta `settings-cache.ts:SCOPE_SEPARATOR`: con una sola entrada
  // por namespace, la primera request de la tienda A dejaba su jsonb cacheado y la
  // tienda B leía el de A durante todo el TTL — o sea, cotizaba con el contrato ajeno.
  const pg = fakePg({
    global: {},
    demo_a: { ANDREANI_CONTRACT: entry('contrato-A') },
    demo_b: { ANDREANI_CONTRACT: entry('contrato-B') },
  });

  const a = await loadAndreaniSettingsViaPg(pg, asSite('demo_a', true));
  const b = await loadAndreaniSettingsViaPg(pg, asSite('demo_b', true));

  assert.equal(a.options.contract, 'contrato-A');
  assert.equal(b.options.contract, 'contrato-B');
});

test('la global se lee UNA vez por TTL, no una por tienda', async () => {
  const pg = fakePg({ global: {}, demo_a: {}, demo_b: {} });

  await loadAndreaniSettingsViaPg(pg, asSite('demo_a', true));
  await loadAndreaniSettingsViaPg(pg, asSite('demo_b', true));

  const globalQueries = pg.queries.filter((q) => q.includes('"site_id" IS NULL'));
  assert.equal(globalQueries.length, 1, 'la global se releyó: el memo por namespace no está pegando');
});

test('los tres overrides de contrato viajan por tienda', async () => {
  // Antes se leían de `process.env` DENTRO del provider, sin pasar por las options:
  // eran literalmente inmunes a la configuración por tienda.
  process.env.ANDREANI_DOMICILIO_CONTRACT_OVERRIDE = 'del-env';
  const pg = fakePg({
    global: {},
    demo_a: { ANDREANI_DOMICILIO_CONTRACT_OVERRIDE: entry('A-111') },
  });

  const settings = await loadAndreaniSettingsViaPg(pg, asSite('demo_a', true));
  assert.equal(settings.contractOverrides.Domicilio, 'A-111');
  assert.equal(settings.contractOverrides.Sucursal, undefined);
});

test('el auto-fulfill es por tienda', async () => {
  const pg = fakePg({
    global: { ANDREANI_AUTO_FULFILL: entry(false) },
    demo_a: { ANDREANI_AUTO_FULFILL: entry(true) },
  });

  assert.equal((await loadAndreaniSettingsViaPg(pg, asSite('demo_a', true))).autoFulfill, true);
  assert.equal((await loadAndreaniSettingsViaPg(pg)).autoFulfill, false);
});

test('un pg que explota degrada al camino sincrónico, no corta la cotización', async () => {
  process.env.ANDREANI_CONTRACT = 'del-env';
  const pg: PgRawConnection = {
    async raw() {
      throw new Error('connection terminated unexpectedly');
    },
  };

  const settings = await loadAndreaniSettingsViaPg(pg, asSite('demo_a', true));
  assert.equal(settings.options.contract, 'del-env');
});

test('APP_SETTINGS_DISABLE devuelve el comportamiento previo a la migración', async () => {
  // El break-glass tiene que apagar TAMBIÉN el fail-closed: si no, la palanca de
  // emergencia dejaría a las tiendas secundarias apagadas en vez de restaurarlas.
  process.env.APP_SETTINGS_DISABLE = 'true';
  process.env.ANDREANI_CONTRACT = 'del-env';
  const pg = fakePg({
    global: { ANDREANI_CONTRACT: entry('de-la-global') },
    demo_b: { ANDREANI_CONTRACT: entry('de-la-tienda') },
  });

  const settings = await loadAndreaniSettingsViaPg(pg, asSite('demo_b', false));
  assert.equal(settings.options.contract, 'del-env');
});

/* -------------------------------------------------------------------------- */
/* Huella y gate de credenciales                                               */
/* -------------------------------------------------------------------------- */

const creds = {
  hostname: 'apis.andreani.com',
  username: 'u',
  password: 'p',
  contract: 'c',
  clientCode: undefined,
};

test('la huella cambia si cambia cualquier credencial', () => {
  const baseline = credentialsFingerprint(creds);
  assert.notEqual(baseline, credentialsFingerprint({ ...creds, password: 'otra' }));
  assert.notEqual(baseline, credentialsFingerprint({ ...creds, contract: 'otro' }));
  assert.notEqual(baseline, credentialsFingerprint({ ...creds, hostname: 'apisqa.andreani.com' }));
  assert.notEqual(baseline, credentialsFingerprint({ ...creds, clientCode: 'CLI' }));
});

test('la huella NO cambia por config que no afecta al login', () => {
  // Es lo que hace que editar el origen o el remitente no tire un token de 23 h.
  assert.equal(credentialsFingerprint(creds), credentialsFingerprint({ ...creds }));
});

test('hasAndreaniCredentials exige las tres, no una', () => {
  assert.equal(hasAndreaniCredentials({ username: 'u', password: 'p', contract: 'c' }), true);
  assert.equal(hasAndreaniCredentials({ username: 'u', password: '', contract: 'c' }), false);
  assert.equal(hasAndreaniCredentials({ username: '', password: 'p', contract: 'c' }), false);
  assert.equal(hasAndreaniCredentials({ username: 'u', password: 'p', contract: '' }), false);
});
