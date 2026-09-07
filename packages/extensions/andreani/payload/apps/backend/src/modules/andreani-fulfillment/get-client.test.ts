import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { encryptCredentials } from '../../lib/multistore/credentials.ts';
import { SITE_REGISTRY_MODULE } from '../../lib/multistore/module-key.ts';
import { invalidateAllNamespaces } from '../../lib/settings-cache.ts';
import {
  __resetAndreaniClientCache,
  getAndreaniContext,
  getAndreaniContextForSite,
  getCachedAndreaniClient,
} from './get-client.ts';

/**
 * Las TRES capas juntas: `site_setting` + `site_credential` + entorno.
 *
 * Es el primer test de Andreani que EJECUTA el código en vez de grepear el fuente.
 * Antes no se podía: `client.ts` importaba `AxiosInstance` como valor y cualquier
 * import del módulo moría bajo `node --experimental-transform-types`.
 *
 * El container es falso pero las funciones son las de verdad: `resolveSite`,
 * `readSiteCredentials` y `loadAndreaniSettingsViaPg` corren tal cual, contra un
 * `pg` que devuelve filas de mentira. Lo que se prueba son las decisiones —qué capa
 * gana, qué pasa con un blob ilegible, cuándo se reusa el cliente—, que es
 * exactamente lo que no se puede ver grepeando.
 */

const logger = {
  info() {},
  warn(message: string) {
    warnings.push(message);
  },
  error() {},
  debug() {},
};
let warnings: string[] = [];

const entry = (value: unknown) => ({
  value,
  ciphertext: null,
  is_secret: false,
  updated_at: null,
  updated_by: null,
});

type Fixture = {
  /** Filas de `demo_store`. La primera con `is_main` decide la principal. */
  sites?: Array<{
    id: string;
    slug: string;
    is_main: boolean;
    sales_channel_id: string | null;
  }>;
  /** jsonb de `site_setting` por scope: `'global'` o el id de la tienda. */
  settings?: Record<string, Record<string, unknown>>;
  /** Blob YA CIFRADO de `site_credential`, por id de tienda. */
  credentials?: Record<string, string>;
  /** Blob roto a mano, para simular `JWT_SECRET` rotado. */
  brokenCredentials?: Record<string, string>;
};

function fakeContainer(fixture: Fixture) {
  const sites = fixture.sites ?? [];

  const pg = {
    async raw(sql: string, bindings: unknown[] = []) {
      if (sql.includes('"site_setting"')) {
        const key = sql.includes('"site_id" IS NULL') ? 'global' : String(bindings[1]);
        const blob = fixture.settings?.[key];
        return { rows: blob ? [{ value: blob }] : [] };
      }
      if (sql.includes('"site_credential"')) {
        const siteId = String(bindings[0]);
        const blob = fixture.credentials?.[siteId] ?? fixture.brokenCredentials?.[siteId];
        return { rows: blob ? [{ credentials_enc: blob }] : [] };
      }
      return { rows: [] };
    },
  };

  return {
    resolve(key: string) {
      if (key === SITE_REGISTRY_MODULE) {
        return {
          async listDemoStores(filters: Record<string, unknown> = {}, config: Record<string, unknown> = {}) {
            const matches = sites.filter((site) => {
              if (filters.id) return site.id === filters.id;
              if (filters.slug) return site.slug === filters.slug;
              if (filters.is_main) return site.is_main;
              if (Array.isArray(filters.$or)) {
                return (filters.$or as Array<Record<string, unknown>>).some(
                  (clause) => clause.sales_channel_id === site.sales_channel_id,
                );
              }
              return true;
            });
            const take = Number(config.take) || matches.length;
            return matches.slice(0, take).map((site) => ({
              ...site,
              name: site.slug,
              b2b_sales_channel_id: null,
              region_id: null,
              stock_location_id: null,
            }));
          },
        };
      }
      if (key === ContainerRegistrationKeys.PG_CONNECTION) return pg;
      throw new Error(`no registrado: ${key}`);
    },
  } as never;
}

const twoSites = [
  { id: 'demo_a', slug: 'a', is_main: true, sales_channel_id: 'sc_a' },
  { id: 'demo_b', slug: 'b', is_main: false, sales_channel_id: 'sc_b' },
];

const ENV_KEYS = ['ANDREANI_USERNAME', 'ANDREANI_PASSWORD', 'ANDREANI_CONTRACT'];

beforeEach(() => {
  warnings = [];
  invalidateAllNamespaces();
  __resetAndreaniClientCache();
  for (const key of ENV_KEYS) delete process.env[key];
});

test('sin tienda resuelta, el contexto es el de la instancia', async () => {
  process.env.ANDREANI_USERNAME = 'env-user';
  const container = fakeContainer({ sites: [] });

  const ctx = await getAndreaniContextForSite(container, {}, logger);
  assert.equal(ctx.credentialSource, 'instance');
  assert.equal(ctx.options.username, 'env-user');
});

test('la tienda con credenciales propias despacha con LAS SUYAS', async () => {
  // EL arreglo. Antes esto sólo pasaba al cotizar; al dar de alta el envío se usaba
  // siempre la cuenta del entorno.
  process.env.ANDREANI_USERNAME = 'env-user';
  process.env.ANDREANI_PASSWORD = 'env-pass';
  process.env.ANDREANI_CONTRACT = 'env-contract';

  const container = fakeContainer({
    sites: twoSites,
    credentials: {
      demo_a: encryptCredentials({
        username: 'user-a',
        password: 'pass-a',
        contract: 'contract-a',
      }),
    },
  });

  const ctx = await getAndreaniContextForSite(container, { salesChannelId: 'sc_a' }, logger);
  assert.equal(ctx.credentialSource, 'site');
  assert.equal(ctx.options.username, 'user-a');
  assert.equal(ctx.options.contract, 'contract-a');
  assert.equal(ctx.configured, true);
});

test('dos tiendas dan DOS clientes distintos, y cada una reusa el suyo', async () => {
  // Sin el cache por huella esto sería un `GET /login` por cotización, y Andreani
  // tiene rate limit. Con un cache mal hecho —por namespace y no por tienda— la
  // tienda B despacharía con el cliente de la A, que es peor.
  const container = fakeContainer({
    sites: twoSites,
    credentials: {
      demo_a: encryptCredentials({ username: 'a', password: 'a', contract: 'a' }),
      demo_b: encryptCredentials({ username: 'b', password: 'b', contract: 'b' }),
    },
  });

  const a1 = await getAndreaniContextForSite(container, { salesChannelId: 'sc_a' }, logger);
  const b1 = await getAndreaniContextForSite(container, { salesChannelId: 'sc_b' }, logger);
  const a2 = await getAndreaniContextForSite(container, { salesChannelId: 'sc_a' }, logger);

  assert.notEqual(a1.client, b1.client, 'las dos tiendas comparten cliente: se cruzaron las cuentas');
  assert.equal(a1.client, a2.client, 'la tienda A reconstruyó su cliente: se perdió el token');
});

test('la configuración por tienda viaja junto con las credenciales', async () => {
  // El contrato por servicio era el que más se escapaba: se leía de `process.env`
  // adentro del provider, así que no lo tocaba ni la tienda ni las options.
  const container = fakeContainer({
    sites: twoSites,
    settings: {
      global: { ANDREANI_DOMICILIO_CONTRACT_OVERRIDE: entry('global-dom') },
      demo_a: {
        ANDREANI_DOMICILIO_CONTRACT_OVERRIDE: entry('A-dom'),
        ANDREANI_ORIGIN_CITY: entry('Rosario'),
      },
    },
    credentials: {
      demo_a: encryptCredentials({ username: 'a', password: 'a', contract: 'A-base' }),
    },
  });

  const ctx = await getAndreaniContextForSite(container, { salesChannelId: 'sc_a' }, logger);
  assert.equal(ctx.contractFor('Domicilio'), 'A-dom');
  assert.equal(ctx.contractFor('Sucursal'), 'A-base', 'sin override, el contrato base de la tienda');
  assert.equal(ctx.options.origin.city, 'Rosario');
});

test('un blob de credenciales ILEGIBLE corta, no cae a la cuenta de la instancia', async () => {
  // La decisión más cara del sistema: el envío sale igual y se le factura al titular
  // equivocado, así que fallar es lo barato.
  process.env.ANDREANI_USERNAME = 'env-user';
  const container = fakeContainer({
    sites: twoSites,
    brokenCredentials: { demo_a: 'v1:no:es:descifrable' },
  });

  await assert.rejects(
    () => getAndreaniContextForSite(container, { salesChannelId: 'sc_a' }, logger),
    /no se pueden descifrar/,
  );
});

test('un fallo de LECTURA degrada al contexto de instancia, con aviso', async () => {
  process.env.ANDREANI_USERNAME = 'env-user';
  const container = {
    resolve(key: string) {
      if (key === SITE_REGISTRY_MODULE) {
        return {
          async listDemoStores() {
            throw new Error('connection terminated unexpectedly');
          },
        };
      }
      throw new Error(`no registrado: ${key}`);
    },
  } as never;

  const ctx = await getAndreaniContextForSite(container, { salesChannelId: 'sc_a' }, logger);
  assert.equal(ctx.credentialSource, 'instance');
  assert.equal(ctx.options.username, 'env-user');
  assert.ok(
    warnings.some((w) => w.includes('Se usa la de la instancia')),
    'degradó en silencio: sin warn no hay forma de enterarse',
  );
});

test('el contexto de instancia reusa el cliente entre llamadas', async () => {
  const a = getAndreaniContext(logger);
  const b = getAndreaniContext(logger);
  assert.equal(a.client, b.client);
});

test('cambiar UNA credencial produce un cliente nuevo', async () => {
  const base = getAndreaniContext(logger).options;
  assert.notEqual(
    getCachedAndreaniClient({ ...base, password: 'otra' }, logger),
    getCachedAndreaniClient(base, logger),
  );
});
