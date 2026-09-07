import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SettingDescriptor, SettingType } from './descriptors/types';
import type { SiteRef, SiteResolution } from '../../lib/multistore/types';

process.env.APP_SETTINGS_ENC_KEY = 'resolve-test-key';
const { encryptSecret } = await import('./crypto.ts');
const { computeSettingState, effectiveSiteKind, resolveEffectiveValue, resolveSetting, isDbLayerDisabled } =
  await import('./resolve.ts');
type AppSettingRow = import('./resolve.ts').AppSettingRow;

/**
 * `resolve.ts` ya no decide QUIÉN gana —eso es `precedence.test.ts`—: decide cómo
 * se traduce el mundo real (filas con secretos cifrados, `process.env`, el
 * break-glass, el `scope` del descriptor) a las capas que la precedencia espera.
 * Estos tests son sobre esa traducción, y sobre el estado que ve el admin.
 */

const d = (
  key: string,
  type: SettingType,
  extra: Partial<SettingDescriptor> = {},
): SettingDescriptor => ({
  key,
  namespace: 'extension:test',
  env: [key],
  type,
  tier: 'runtime',
  scope: 'site',
  group: 'g',
  label: key,
  ...extra,
});

const envFrom =
  (map: Record<string, string | undefined>) =>
  (name: string): string | undefined =>
    map[name];

const row = (over: Partial<AppSettingRow> = {}): AppSettingRow => ({
  key: 'HOST',
  value: 'db.local',
  ciphertext: null,
  is_secret: false,
  updated_at: '2026-08-01T10:00:00.000Z',
  updated_by: 'user_1',
  ...over,
});

const siteRef = (over: Partial<SiteRef> = {}): SiteRef => ({
  id: 'demo_1',
  slug: 'uno',
  name: 'Uno',
  is_main: false,
  channel_ids: [],
  region_id: null,
  stock_location_id: null,
  ...over,
});

const MAIN: SiteResolution = { status: 'site', site: siteRef({ id: 'demo_main', is_main: true }) };
const SECONDARY: SiteResolution = { status: 'site', site: siteRef({ id: 'demo_b' }) };
const ALL_SITES: SiteResolution = { status: 'allSites' };
const SINGLE: SiteResolution = { status: 'singleSite', site: siteRef({ is_main: true }) };
const UNKNOWN: SiteResolution = { status: 'unknownSite', hint: { siteId: 'demo_borrada' } };

// ─── precedencia, ya cableada a las dos capas ────────────────────────────────

test('sin tienda: la global gana sobre env', () => {
  const env = envFrom({ HOST: 'env.local' });
  assert.equal(resolveEffectiveValue(d('HOST', 'string'), { global: row() }, { envRead: env }), 'db.local');
});

test('sin capas, gana env', () => {
  const env = envFrom({ HOST: 'env.local' });
  assert.equal(resolveEffectiveValue(d('HOST', 'string'), {}, { envRead: env }), 'env.local');
});

test('sin capas ni env, gana el default del descriptor', () => {
  const desc = d('HOST', 'string', { default: 'localhost' });
  assert.equal(resolveEffectiveValue(desc, {}, { envRead: envFrom({}) }), 'localhost');
});

test('sin nada, undefined', () => {
  assert.equal(resolveEffectiveValue(d('HOST', 'string'), {}, { envRead: envFrom({}) }), undefined);
});

test('borrar la entrada devuelve el control al env (rollback)', () => {
  const desc = d('HOST', 'string');
  const env = envFrom({ HOST: 'env.local' });
  assert.equal(resolveEffectiveValue(desc, { global: row() }, { envRead: env }), 'db.local');
  assert.equal(resolveEffectiveValue(desc, {}, { envRead: env }), 'env.local');
});

test('la tienda principal hereda de la global', () => {
  const state = resolveSetting(d('HOST', 'string'), { global: row() }, {
    resolution: MAIN,
    envRead: envFrom({}),
  });
  assert.deepEqual(state, { value: 'db.local', source: 'global' });
});

test('la fila de la tienda le gana a la global', () => {
  const state = resolveSetting(
    d('HOST', 'string'),
    { site: row({ value: 'de-la-tienda' }), global: row() },
    { resolution: MAIN, envRead: envFrom({}) },
  );
  assert.deepEqual(state, { value: 'de-la-tienda', source: 'site' });
});

test('FAIL-CLOSED: una tienda secundaria sin fila propia NO hereda nada', () => {
  const state = resolveSetting(d('HOST', 'string'), { global: row() }, {
    resolution: SECONDARY,
    envRead: envFrom({ HOST: 'env.local' }),
  });
  assert.deepEqual(state, { value: undefined, source: 'off' });
});

test('un descriptor `scope: instance` IGNORA la tienda y nunca fail-cierra', () => {
  const desc = d('HOST', 'string', { scope: 'instance' });
  // Misma secundaria del test anterior: acá tiene que ver la global igual.
  const state = resolveSetting(desc, { site: row({ value: 'ruido' }), global: row() }, {
    resolution: SECONDARY,
    envRead: envFrom({}),
  });
  assert.deepEqual(state, { value: 'db.local', source: 'global' });
});

test('`allSites` y `singleSite` resuelven como instancia', () => {
  for (const resolution of [ALL_SITES, SINGLE]) {
    const state = resolveSetting(d('HOST', 'string'), { global: row() }, {
      resolution,
      envRead: envFrom({}),
    });
    assert.deepEqual(state, { value: 'db.local', source: 'global' }, resolution.status);
  }
});

test('una tienda desconocida fail-cierra aunque el guard de la ruta se olvide', () => {
  const state = resolveSetting(d('HOST', 'string'), { global: row() }, {
    resolution: UNKNOWN,
    envRead: envFrom({ HOST: 'env.local' }),
  });
  assert.equal(state.source, 'off');
});

// ─── `effectiveSiteKind` ─────────────────────────────────────────────────────

test('effectiveSiteKind cruza el scope del descriptor con la tienda', () => {
  const env = envFrom({});
  assert.equal(effectiveSiteKind({ scope: 'site' }, MAIN, env), 'main');
  assert.equal(effectiveSiteKind({ scope: 'site' }, SECONDARY, env), 'secondary');
  assert.equal(effectiveSiteKind({ scope: 'site' }, undefined, env), 'none');
  assert.equal(effectiveSiteKind({ scope: 'instance' }, SECONDARY, env), 'none');
});

// ─── break-glass ─────────────────────────────────────────────────────────────

test('APP_SETTINGS_DISABLE ignora la base por completo', () => {
  const env = envFrom({ HOST: 'env.local', APP_SETTINGS_DISABLE: 'true' });
  assert.equal(isDbLayerDisabled(env), true);
  assert.equal(
    resolveEffectiveValue(d('HOST', 'string'), { global: row() }, { envRead: env }),
    'env.local',
  );
  assert.equal(
    computeSettingState(d('HOST', 'string'), { global: row() }, { envRead: env }).source,
    'env',
  );
});

test('el break-glass apaga TAMBIÉN el fail-closed: una secundaria vuelve al env', () => {
  // Sin esto, la palanca de emergencia apagaría las integraciones de todas las
  // tiendas secundarias en vez de restaurarlas.
  const env = envFrom({ HOST: 'env.local', APP_SETTINGS_DISABLE: 'true' });
  const state = resolveSetting(d('HOST', 'string'), { global: row() }, {
    resolution: SECONDARY,
    envRead: env,
  });
  assert.deepEqual(state, { value: 'env.local', source: 'env' });
});

// ─── secretos ────────────────────────────────────────────────────────────────

const secretRow = (plain: string, over: Partial<AppSettingRow> = {}): AppSettingRow =>
  row({ key: 'API_KEY', value: null, is_secret: true, ciphertext: encryptSecret(plain), ...over });

test('un secreto se descifra para uso interno', () => {
  const desc = d('API_KEY', 'secret');
  const rows = { global: secretRow('sk-12345678') };
  assert.equal(resolveEffectiveValue(desc, rows, { envRead: envFrom({}) }), 'sk-12345678');
});

test('un secreto NUNCA sale en claro por el estado que ve el admin', () => {
  const desc = d('API_KEY', 'secret');
  const state = computeSettingState(desc, { global: secretRow('sk-12345678') }, { envRead: envFrom({}) });
  assert.equal(state.value, null);
  assert.equal(state.preview, '••••5678');
  assert.equal(state.decryptable, true);
  assert.equal(state.source, 'global');
});

test('un secreto indescifrable cae a env sin tirar, y se reporta como tal', () => {
  const desc = d('API_KEY', 'secret');
  const rows = { global: row({ key: 'API_KEY', value: null, is_secret: true, ciphertext: 'v1:zz:zz:zz' }) };
  const env = envFrom({ API_KEY: 'del-entorno' });

  assert.equal(resolveEffectiveValue(desc, rows, { envRead: env }), 'del-entorno');

  const state = computeSettingState(desc, rows, { envRead: env });
  assert.equal(state.decryptable, false);
  assert.equal(state.preview, null);
  // El origen refleja lo que se va a USAR, no lo que hay guardado.
  assert.equal(state.source, 'env');
  assert.equal(state.is_set, true);
});

test('un secreto de tienda indescifrable NO cae a la global: fail-closed', () => {
  // El valor guardado es inservible, así que la tienda queda sin credencial. Caer
  // a la global sería despachar con la cuenta de la instancia.
  const desc = d('API_KEY', 'secret');
  const state = computeSettingState(
    desc,
    {
      site: row({ key: 'API_KEY', value: null, is_secret: true, ciphertext: 'v1:zz:zz:zz' }),
      global: secretRow('sk-de-la-instancia'),
    },
    { resolution: SECONDARY, envRead: envFrom({ API_KEY: 'del-entorno' }) },
  );
  assert.equal(state.source, 'off');
  assert.equal(state.preview, null);
  assert.equal(state.decryptable, false);
});

test('un secreto que vive en el env tampoco se filtra: sólo se informa que está', () => {
  const state = computeSettingState(d('API_KEY', 'secret'), {}, { envRead: envFrom({ API_KEY: 'sk-x' }) });
  assert.equal(state.value, null);
  assert.equal(state.preview, null);
  assert.equal(state.env_present, true);
  assert.equal(state.source, 'env');
  assert.equal('decryptable' in state, false);
});

// ─── estado para la UI ───────────────────────────────────────────────────────

test('source distingue site / global / env / default / off / unset', () => {
  const plain = d('HOST', 'string');
  const withDefault = d('HOST', 'string', { default: 'localhost' });

  assert.equal(
    computeSettingState(plain, { site: row(), global: row() }, { resolution: MAIN, envRead: envFrom({}) }).source,
    'site',
  );
  assert.equal(computeSettingState(plain, { global: row() }, { envRead: envFrom({}) }).source, 'global');
  assert.equal(computeSettingState(plain, {}, { envRead: envFrom({ HOST: 'e' }) }).source, 'env');
  assert.equal(computeSettingState(withDefault, {}, { envRead: envFrom({}) }).source, 'default');
  assert.equal(computeSettingState(plain, {}, { envRead: envFrom({}) }).source, 'unset');
  assert.equal(
    computeSettingState(plain, { global: row() }, { resolution: SECONDARY, envRead: envFrom({}) }).source,
    'off',
  );
});

test('is_set habla del scope que la pantalla EDITA, no de si hay valor', () => {
  const desc = d('HOST', 'string');

  // Con env presente hay valor efectivo, pero nadie tocó nada.
  assert.equal(computeSettingState(desc, {}, { envRead: envFrom({ HOST: 'e' }) }).is_set, false);
  // Sin tienda, el scope editable es el global.
  assert.equal(computeSettingState(desc, { global: row() }, { envRead: envFrom({}) }).is_set, true);
  // CON tienda activa, un valor heredado de la global NO es un override propio:
  // esto es lo que le dice al operador "esta tienda todavía sigue a la instancia".
  assert.equal(
    computeSettingState(desc, { global: row() }, { resolution: MAIN, envRead: envFrom({}) }).is_set,
    false,
  );
  assert.equal(
    computeSettingState(desc, { site: row(), global: row() }, { resolution: MAIN, envRead: envFrom({}) })
      .is_set,
    true,
  );
});

test('un descriptor `instance` edita SIEMPRE la global, aun con tienda activa', () => {
  const desc = d('HOST', 'string', { scope: 'instance' });
  const state = computeSettingState(desc, { global: row() }, { resolution: SECONDARY, envRead: envFrom({}) });
  assert.equal(state.is_set, true);
  assert.equal(state.source, 'global');
});

test('env_present es independiente de que haya override', () => {
  const state = computeSettingState(d('HOST', 'string'), { global: row() }, {
    envRead: envFrom({ HOST: 'e' }),
  });
  assert.equal(state.source, 'global');
  assert.equal(state.env_present, true);
});

test('la autoría es la del valor que se está usando', () => {
  const state = computeSettingState(
    d('HOST', 'string'),
    {
      site: row({ value: 'de-la-tienda', updated_by: 'user_site' }),
      global: row({ updated_by: 'user_global' }),
    },
    { resolution: MAIN, envRead: envFrom({}) },
  );
  assert.equal(state.updated_by, 'user_site');
});

test('updated_at se normaliza a ISO venga Date o string', () => {
  const asDate = computeSettingState(
    d('HOST', 'string'),
    { global: row({ updated_at: new Date('2026-08-01T10:00:00.000Z') }) },
    { envRead: envFrom({}) },
  );
  assert.equal(asDate.updated_at, '2026-08-01T10:00:00.000Z');
  assert.equal(computeSettingState(d('HOST', 'string'), {}, { envRead: envFrom({}) }).updated_at, null);
});

test('`false`, `0` y `\'\'` son valores, no ausencias', () => {
  const flag = d('FLAG', 'boolean', { default: true });
  const state = computeSettingState(flag, { global: row({ key: 'FLAG', value: false }) }, {
    envRead: envFrom({}),
  });
  assert.equal(state.source, 'global');
  assert.equal(state.value, false);
});
