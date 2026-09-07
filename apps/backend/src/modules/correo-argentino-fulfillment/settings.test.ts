import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SCOPE_SEPARATOR, invalidateNamespace } from '../../lib/settings-cache.ts';
import type { SiteRef, SiteResolution } from '../../lib/multistore/types.ts';
import { __resetSnapshot, replaceSnapshot } from '../app-settings/snapshot.ts';
import {
  CORREO_SETTINGS_NAMESPACE,
  loadCorreoOperationSettingsViaPg,
  loadCorreoSettingsViaPg,
  getCorreoSettings,
  micorreoFingerprint,
  paqarFingerprint,
} from './settings.ts';

/**
 * Lo que se verifica acá es la parte que NO tiene otro guard: que la capa de
 * TIENDA exista de verdad, que el fail-closed llegue hasta las options del
 * carrier, y que la cache no mezcle tiendas.
 *
 * Los tres son fallas silenciosas. Ninguna produce un error: producen un envío
 * despachado con la cuenta equivocada.
 */

// ── doble de `pg` ────────────────────────────────────────────────────────────

type Blob = Record<string, unknown>;

/** Sobre de `site_setting`, tal como lo escribe `mergeNamespaceBlob`. */
const entry = (value: unknown): Blob => ({
  value,
  ciphertext: null,
  is_secret: false,
  updated_at: null,
  updated_by: null,
});

function fakePg(scopes: { global?: Blob; bySite?: Record<string, Blob> }) {
  const calls: Array<{ sql: string; bindings: unknown[] }> = [];
  return {
    calls,
    raw: async (sql: string, bindings: unknown[] = []) => {
      calls.push({ sql, bindings });
      // La query global lleva `site_id IS NULL` y UN solo binding.
      if (/"site_id" IS NULL/.test(sql)) {
        return { rows: scopes.global ? [{ value: scopes.global }] : [] };
      }
      const siteId = String(bindings[1]);
      const blob = scopes.bySite?.[siteId];
      return { rows: blob ? [{ value: blob }] : [] };
    },
  };
}

const siteRef = (id: string, isMain: boolean): SiteRef => ({
  id,
  slug: id,
  name: id,
  is_main: isMain,
  channel_ids: [],
  region_id: null,
  stock_location_id: null,
});

const onSite = (id: string, isMain: boolean): SiteResolution => ({
  status: 'site',
  site: siteRef(id, isMain),
});

const ENV_KEYS = [
  'CORREO_ARGENTINO_API_KEY',
  'CORREO_ARGENTINO_AGREEMENT',
  'CORREO_ARGENTINO_ORIGIN_POSTAL_CODE',
  'CORREO_ARGENTINO_MICORREO_USER',
  'CORREO_ARGENTINO_MICORREO_PASS',
  'CORREO_ARGENTINO_CUSTOMER_ID',
  'CORREO_ARGENTINO_AFORO_DIVISOR',
  'CORREO_ARGENTINO_TEST_MODE',
  'CORREO_ARGENTINO_AUTO_FULFILL',
  'APP_SETTINGS_DISABLE',
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  invalidateNamespace(CORREO_SETTINGS_NAMESPACE);
  __resetSnapshot();
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  invalidateNamespace(CORREO_SETTINGS_NAMESPACE);
  __resetSnapshot();
});

// ── precedencia ──────────────────────────────────────────────────────────────

describe('loadCorreoSettingsViaPg — precedencia', () => {
  it('la fila de la tienda le gana a la global y al env', async () => {
    process.env.CORREO_ARGENTINO_AGREEMENT = 'del-env';
    const pg = fakePg({
      global: { CORREO_ARGENTINO_AGREEMENT: entry('global') },
      bySite: { demo_norte: { CORREO_ARGENTINO_AGREEMENT: entry('norte') } },
    });

    const options = await loadCorreoSettingsViaPg(pg, onSite('demo_norte', false));
    assert.equal(options.agreement, 'norte');
  });

  it('la tienda PRINCIPAL sin fila propia hereda global → env → default', async () => {
    process.env.CORREO_ARGENTINO_ORIGIN_POSTAL_CODE = '9999';
    const pg = fakePg({ global: { CORREO_ARGENTINO_AGREEMENT: entry('global') } });

    const options = await loadCorreoSettingsViaPg(pg, onSite('demo_main', true));
    assert.equal(options.agreement, 'global', 'no heredó la global');
    assert.equal(options.origin.postalCode, '9999', 'no heredó el env');
    assert.equal(options.serviceType, 'CP', 'no cayó al default del descriptor');
  });

  it('FAIL-CLOSED: una tienda SECUNDARIA sin fila propia no hereda NADA', async () => {
    // Es la regla que impide que la tienda B despache contra el acuerdo de A.
    // Con `''` en apiKey y agreement, `PaqarClient` no puede autenticarse y el
    // alta falla — que es lo correcto: mejor un envío que no sale que uno que
    // sale facturado al titular equivocado.
    process.env.CORREO_ARGENTINO_AGREEMENT = 'del-env';
    process.env.CORREO_ARGENTINO_API_KEY = 'key-del-env';
    const pg = fakePg({
      global: {
        CORREO_ARGENTINO_AGREEMENT: entry('global'),
        CORREO_ARGENTINO_API_KEY: entry('key-global'),
      },
    });

    const options = await loadCorreoSettingsViaPg(pg, onSite('demo_sur', false));
    assert.equal(options.agreement, '');
    assert.equal(options.apiKey, '');
    assert.equal(options.sellerId, '', 'el sellerId derivado tampoco puede filtrarse');
  });

  it('un descriptor `instance` NO cae en fail-closed en una tienda secundaria', async () => {
    // `AFORO_DIVISOR` es de la instancia: si le aplicara fail-closed, la tienda B
    // se quedaría sin coeficiente y el peso volumétrico saldría mal en silencio.
    const pg = fakePg({ global: { CORREO_ARGENTINO_AFORO_DIVISOR: entry(5000) } });

    const options = await loadCorreoSettingsViaPg(pg, onSite('demo_sur', false));
    assert.equal(options.limits.aforoDivisor, 5000);
  });

  it('sin resolución de tienda se lee la instancia (global → env → default)', async () => {
    process.env.CORREO_ARGENTINO_ORIGIN_POSTAL_CODE = '1414';
    const pg = fakePg({ global: { CORREO_ARGENTINO_AGREEMENT: entry('global') } });

    const options = await loadCorreoSettingsViaPg(pg, undefined);
    assert.equal(options.agreement, 'global');
    assert.equal(options.origin.postalCode, '1414');
  });

  it('los booleanos y números guardados en la base llegan tipados', async () => {
    // El jsonb guarda `true` y `4000`, no `"true"` y `"4000"`. Si el resolver los
    // stringificara para reusar el loader de env, un `false` guardado a propósito
    // se leería como el string "false" — que `readBool` toma como... false, pero
    // un `0` se leería como "0" y `readNum` lo descartaría por no ser > 0.
    const pg = fakePg({
      global: {
        CORREO_ARGENTINO_TEST_MODE: entry(true),
        CORREO_ARGENTINO_DIMENSION_FALLBACK_ENABLED: entry(true),
        CORREO_ARGENTINO_MAX_WEIGHT_G: entry(30000),
      },
    });

    const options = await loadCorreoSettingsViaPg(pg, undefined);
    assert.equal(options.testMode, true);
    assert.equal(options.hostname, 'apitest.correoargentino.com.ar');
    assert.equal(options.dimensionFallback.enabled, true);
    assert.equal(options.limits.maxWeightG, 30000);
  });

  it('sin `pg` cae al camino sincrónico en vez de tirar', async () => {
    process.env.CORREO_ARGENTINO_AGREEMENT = 'del-env';
    const options = await loadCorreoSettingsViaPg(undefined, onSite('demo_sur', false));
    assert.equal(options.agreement, 'del-env');
  });

  it('un Postgres que tira degrada al camino sincrónico, no corta el despacho', async () => {
    process.env.CORREO_ARGENTINO_AGREEMENT = 'del-env';
    const pg = {
      raw: async () => {
        throw new Error('connection terminated unexpectedly');
      },
    };
    const options = await loadCorreoSettingsViaPg(pg, onSite('demo_sur', false));
    assert.equal(options.agreement, 'del-env');
  });
});

// ── la cache ─────────────────────────────────────────────────────────────────

describe('cache por scope', () => {
  it('NO mezcla tiendas: la clave lleva el separador de scope', async () => {
    // Con la clave pelada del namespace, la primera request de la tienda A dejaba
    // cacheado su jsonb y la tienda B leía el de A durante todo el TTL. Es un leak
    // cross-tenant con 30 segundos de ventana y sin un solo error.
    const pg = fakePg({
      global: {},
      bySite: {
        demo_norte: { CORREO_ARGENTINO_AGREEMENT: entry('norte') },
        demo_sur: { CORREO_ARGENTINO_AGREEMENT: entry('sur') },
      },
    });

    const norte = await loadCorreoSettingsViaPg(pg, onSite('demo_norte', false));
    const sur = await loadCorreoSettingsViaPg(pg, onSite('demo_sur', false));

    assert.equal(norte.agreement, 'norte');
    assert.equal(sur.agreement, 'sur', 'la tienda B leyó el jsonb de la tienda A');
  });

  it('la segunda lectura del MISMO scope no vuelve a Postgres', async () => {
    const pg = fakePg({ global: { CORREO_ARGENTINO_AGREEMENT: entry('global') } });
    await loadCorreoSettingsViaPg(pg, undefined);
    const after = pg.calls.length;
    await loadCorreoSettingsViaPg(pg, undefined);
    assert.equal(pg.calls.length, after, 'la memoización por scope no está funcionando');
  });

  it('`invalidateNamespace` borra el scope global Y el de cada tienda', async () => {
    const pg = fakePg({
      global: {},
      bySite: { demo_norte: { CORREO_ARGENTINO_AGREEMENT: entry('v1') } },
    });
    assert.equal(
      (await loadCorreoSettingsViaPg(pg, onSite('demo_norte', false))).agreement,
      'v1',
    );

    pg.calls.length = 0;
    invalidateNamespace(CORREO_SETTINGS_NAMESPACE);
    await loadCorreoSettingsViaPg(pg, onSite('demo_norte', false));
    assert.ok(pg.calls.length > 0, 'la entrada de la tienda sobrevivió a la invalidación');
  });

  it('la clave de scope usa el mismo formato que `app-settings/service.ts`', () => {
    // Si divergieran, `invalidateNamespace` (que borra por prefijo) dejaría viva
    // la entrada de este módulo y el admin guardaría sin efecto visible.
    assert.equal(SCOPE_SEPARATOR, '::');
    assert.equal(
      `${CORREO_SETTINGS_NAMESPACE}${SCOPE_SEPARATOR}demo_norte`,
      'extension:correo-argentino::demo_norte',
    );
  });
});

// ── break-glass ──────────────────────────────────────────────────────────────

describe('APP_SETTINGS_DISABLE', () => {
  it('ignora la base por completo, incluido el fail-closed', async () => {
    // El break-glass tiene que RESTAURAR la integración, no apagarla: una tienda
    // secundaria en emergencia vuelve al env, no queda en `off`.
    process.env.APP_SETTINGS_DISABLE = 'true';
    process.env.CORREO_ARGENTINO_AGREEMENT = 'del-env';
    const pg = fakePg({
      bySite: { demo_sur: { CORREO_ARGENTINO_AGREEMENT: entry('sur') } },
    });

    const options = await loadCorreoSettingsViaPg(pg, onSite('demo_sur', false));
    assert.equal(options.agreement, 'del-env');
  });
});

// ── ajustes de operación ─────────────────────────────────────────────────────

describe('loadCorreoOperationSettingsViaPg', () => {
  it('el auto-fulfillment y el prefijo del TN son POR TIENDA', async () => {
    const pg = fakePg({
      global: { CORREO_ARGENTINO_AUTO_FULFILL: entry(false) },
      bySite: {
        demo_norte: {
          CORREO_ARGENTINO_AUTO_FULFILL: entry(true),
          CORREO_ARGENTINO_TN_PREFIX: entry('NOR'),
        },
      },
    });

    const norte = await loadCorreoOperationSettingsViaPg(pg, onSite('demo_norte', false));
    assert.equal(norte.autoFulfill, true);
    assert.equal(norte.trackingNumberPrefix, 'NOR');

    const global = await loadCorreoOperationSettingsViaPg(pg, undefined);
    assert.equal(global.autoFulfill, false);
    assert.equal(global.trackingNumberPrefix, 'MER');
  });

  it('`false` guardado a propósito NO se pierde contra el env', async () => {
    process.env.CORREO_ARGENTINO_AUTO_FULFILL = 'true';
    const pg = fakePg({ global: { CORREO_ARGENTINO_AUTO_FULFILL: entry(false) } });

    const ops = await loadCorreoOperationSettingsViaPg(pg, undefined);
    assert.equal(ops.autoFulfill, false, 'un `??`/`||` mal puesto se comió el false');
  });
});

// ── camino sincrónico ────────────────────────────────────────────────────────

describe('getCorreoSettings', () => {
  it('antes del loader devuelve el env, igual que antes de la migración', () => {
    process.env.CORREO_ARGENTINO_AGREEMENT = 'del-env';
    assert.equal(getCorreoSettings().agreement, 'del-env');
  });

  it('con el snapshot cargado, la fila global le gana al env', () => {
    process.env.CORREO_ARGENTINO_AGREEMENT = 'del-env';
    replaceSnapshot([
      {
        namespace: CORREO_SETTINGS_NAMESPACE,
        key: 'CORREO_ARGENTINO_AGREEMENT',
        value: 'del-snapshot',
        ciphertext: null,
        is_secret: false,
      },
    ] as never);
    assert.equal(getCorreoSettings().agreement, 'del-snapshot');
  });
});

// ── huellas ──────────────────────────────────────────────────────────────────

describe('huellas de cliente', () => {
  const base = {
    api: {
      paqar: { hostname: 'h', basePath: '/p', baseUrl: 'https://h/p' },
      micorreo: { hostname: 'h', basePath: '/m', baseUrl: 'https://h/m' },
    },
    apiKey: 'k',
    agreement: 'a',
    sellerId: 'a',
    extClient: undefined,
    micorreo: { username: 'u', password: 'p', customerId: 'c' },
    limits: { maxWeightG: 25000, maxDimensionCm: 150, aforoDivisor: 4000 },
  } as never as Parameters<typeof paqarFingerprint>[0];

  it('el acuerdo cambia la huella de paqar: viaja como header en cada request', () => {
    assert.notEqual(
      paqarFingerprint(base),
      paqarFingerprint({ ...base, agreement: 'otro' }),
    );
  });

  it('el customerId cambia la huella de MiCorreo: es la identidad del comerciante', () => {
    assert.notEqual(
      micorreoFingerprint(base),
      micorreoFingerprint({ ...base, micorreo: { ...base.micorreo, customerId: 'otro' } }),
    );
  });

  it('las dos huellas son ESTABLES para la misma configuración', () => {
    // Si no lo fueran, el cliente se reconstruiría en cada llamada y MiCorreo
    // pediría un JWT nuevo por cotización.
    assert.equal(paqarFingerprint(base), paqarFingerprint({ ...base }));
    assert.equal(micorreoFingerprint(base), micorreoFingerprint({ ...base }));
  });

  it('cambiar sólo lo de MiCorreo NO invalida el cliente de paqar', () => {
    const otro = { ...base, micorreo: { ...base.micorreo, password: 'nueva' } };
    assert.equal(paqarFingerprint(base), paqarFingerprint(otro));
    assert.notEqual(micorreoFingerprint(base), micorreoFingerprint(otro));
  });
});
