import { test } from 'node:test';
import assert from 'node:assert/strict';
import descriptors from '../app-settings/descriptors/fragments/catalog-import.ts';
import { __resetSnapshot, replaceSnapshot } from '../app-settings/snapshot.ts';
import {
  getStoreImporterSettings,
  loadStoreImporterSettingsViaPg,
  type PgRawConnection,
} from './settings.ts';

/**
 * El contrato de env vars del Importador de catálogo, congelado.
 *
 * `manifest-drift.test.ts` sólo mira los namespaces que están en
 * `descriptors/index.ts`, y `extension:store-importer` todavía no está: el ensamblado
 * (index + `component-metadata.js` + sacar la entrada de `env-coverage.test.ts`) va en
 * otro paso. Hasta que eso pase, este archivo es lo que impide que el descriptor se
 * desalinee.
 *
 * Las 5 variables salieron de un ripgrep sobre lo que `resolve-ownership.js` le asigna
 * a `store-importer`: `modules/store-importer`, `api/admin/sites/[id]/import-job`,
 * `api/admin/sites/[id]/promotions`, `jobs/process-demo-store-imports.ts` y
 * `scripts/backfill-woocommerce-variant-prices.ts`. El manifest declaraba CERO.
 */

const byKey = new Map(descriptors.settings.map((d) => [d.key, d]));

/** 20 minutos: el mismo literal que tenía el `?? 20 * 60 * 1000` del job. */
const DEFAULT_STALE_MS = 1_200_000;

test('el descriptor cubre las 5 variables, ni una más ni una menos', () => {
  assert.deepEqual([...byKey.keys()], ['DEMO_IMPORT_STALE_MS']);
  assert.deepEqual(
    (descriptors.envOnly ?? []).map((e) => e.key).sort(),
    ['APPLY', 'DEFAULT_CURRENCY_CODE', 'DEMO_IMPORT_CRON', 'DEMO_SLUG'],
  );
});

test('el cron es envOnly y el umbral NO: la línea es dónde se lee cada uno', () => {
  // Las dos viven en el mismo archivo y por eso vale dejarlo escrito: el `schedule:`
  // lo hornea el job loader al arrancar (job-loader.js:69-78) y no hay fila que
  // llegue a tiempo; el umbral lo evalúa el CUERPO del job en cada tick, así que sí
  // se puede leer de la base. Confundirlas es el error clásico de esta migración.
  const cron = (descriptors.envOnly ?? []).find((e) => e.key === 'DEMO_IMPORT_CRON');
  assert.ok(cron, 'el cron tiene que estar en envOnly');
  assert.match(cron!.reason, /job-loader/, 'la razón tiene que citar por qué no se puede');

  const stale = byKey.get('DEMO_IMPORT_STALE_MS')!;
  assert.equal(stale.type, 'number');
  assert.equal(stale.tier, 'runtime');
  // `instance`: el job barre las importaciones de TODAS las tiendas en una pasada.
  assert.equal(stale.scope, 'instance');
  assert.equal(stale.default, DEFAULT_STALE_MS);
});

test('APPLY y DEMO_SLUG están declaradas como banderas de comando, no como config', () => {
  // Son el caso que más fácil se cuela: nombres genéricos, leídas con `process.env`
  // como cualquier otra. La diferencia es que persistirlas en la base convertiría un
  // dry-run en una escritura real, o dejaría un backfill acotado a la tienda de la
  // corrida anterior. La razón tiene que decirlo, porque es lo que la card muestra.
  for (const key of ['APPLY', 'DEMO_SLUG']) {
    const entry = (descriptors.envOnly ?? []).find((e) => e.key === key)!;
    assert.ok(entry, `${key}: falta en envOnly`);
    assert.ok(!byKey.has(key), `${key}: no puede ser editable`);
    assert.ok(entry.reason.length > 60, `${key}: la razón tiene que explicar por qué`);
  }
});

test('sin fila ni env, el default es el mismo que tenía el job', () => {
  __resetSnapshot();
  delete process.env.DEMO_IMPORT_STALE_MS;
  assert.deepEqual(getStoreImporterSettings(), { staleMs: DEFAULT_STALE_MS });
});

test('la fila de site_setting le gana a la env var', () => {
  process.env.DEMO_IMPORT_STALE_MS = '300000';
  replaceSnapshot([
    {
      namespace: 'extension:multistore',
      key: 'DEMO_IMPORT_STALE_MS',
      value: 900_000,
      ciphertext: null,
      is_secret: false,
    },
  ] as never);

  assert.equal(getStoreImporterSettings().staleMs, 900_000);

  __resetSnapshot();
  assert.equal(getStoreImporterSettings().staleMs, 300_000);
  delete process.env.DEMO_IMPORT_STALE_MS;
});

test('un umbral inválido cae al default en vez de matar toda importación viva', () => {
  // Es el peor modo de falla del archivo entero y por eso tiene su propio test: con
  // `staleMs` en NaN o en 0, la comparación `now - lastActivity < STALE_MS` es SIEMPRE
  // falsa, así que el primer tick marcaría como huérfana cada importación en curso —
  // incluida una que está andando perfecto.
  __resetSnapshot();
  for (const bad of ['no es un número', '0', '-1']) {
    process.env.DEMO_IMPORT_STALE_MS = bad;
    assert.equal(getStoreImporterSettings().staleMs, DEFAULT_STALE_MS, `valor: ${bad}`);
  }
  delete process.env.DEMO_IMPORT_STALE_MS;
});

test('el camino async cae al sincrónico si Postgres no contesta', () => {
  // Una config que no se puede leer nunca debe abortar el barrido. El job depende de
  // esto: sin la red, un Postgres que parpadea dejaría importaciones trabadas en
  // "running" hasta el próximo reinicio.
  __resetSnapshot();
  process.env.DEMO_IMPORT_STALE_MS = '480000';

  const exploding: PgRawConnection = {
    raw: () => Promise.reject(new Error('connection terminated')),
  };

  return Promise.all([
    loadStoreImporterSettingsViaPg(undefined).then((s) => {
      assert.equal(s.staleMs, 480_000, 'sin conexión');
    }),
    loadStoreImporterSettingsViaPg(exploding).then((s) => {
      assert.equal(s.staleMs, 480_000, 'con la conexión rota');
      delete process.env.DEMO_IMPORT_STALE_MS;
    }),
  ]);
});
