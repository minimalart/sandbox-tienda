import { test } from 'node:test';
import assert from 'node:assert/strict';
import descriptors from '../app-settings/descriptors/recommendation-engine.ts';
import { RECOMMENDATIONS_FLOORS } from './settings.ts';

/**
 * El contrato de env vars del motor de recomendaciones, congelado.
 *
 * `manifest-drift.test.ts` sólo mira los namespaces que están en
 * `descriptors/index.ts`, y `extension:recommendation-engine` todavía no está: el
 * ensamblado (index + `component-metadata.js` + sacar la entrada de
 * `env-coverage.test.ts`) va en otro paso. Hasta que eso pase, este archivo es lo
 * que impide que el descriptor se desalinee, y replica los invariantes que ese test
 * va a exigir el día que se conecte.
 *
 * La lista de abajo es LA lista: 20 variables auditadas con ripgrep sobre
 * `modules/recommendations`, `api/store/recommendations`, `api/admin/recommendations`
 * y los cuatro `jobs/recommendations-*`. El manifest declaraba CERO — no siete como
 * Andreani: cero. Nunca se le pidió ninguna a nadie al instalar.
 */

/** Las 12 que se gestionan desde el admin. */
const MANAGED_KEYS = [
  // Estado
  'RECOMMENDATIONS_ENABLED',
  'RECOMMENDATIONS_JOBS_ENABLED',
  'RECOMMENDATIONS_DEBUG',
  // Servicio
  'RECOMMENDATIONS_EVENT_SECRET',
  'RECOMMENDATIONS_RATE_LIMIT_PER_MINUTE',
  'RECOMMENDATIONS_CONFIG_TTL_MS',
  // Recálculo
  'RECOMMENDATIONS_BUILD_MAX_MS',
  'RECOMMENDATIONS_BUILD_BATCH',
  'RECOMMENDATIONS_STALE_MINUTES',
  // Retención y métricas
  'RECOMMENDATIONS_AGGREGATE_LOOKBACK_HOURS',
  'RECOMMENDATIONS_PURGE_BATCH',
  'RECOMMENDATIONS_PURGE_MAX_BATCHES',
];

/** Los cuatro schedules: los hornea el job loader al arrancar. */
const CRON_KEYS = [
  'RECOMMENDATIONS_SCHEDULE_CRON',
  'RECOMMENDATIONS_BUILD_CRON',
  'RECOMMENDATIONS_AGGREGATE_CRON',
  'RECOMMENDATIONS_PURGE_CRON',
];

/** Los cuatro topes duros: acotan valores que el merchant ya edita en su propia UI. */
const CAP_KEYS = [
  'RECOMMENDATIONS_RESULT_LIMIT_CAP',
  'RECOMMENDATIONS_CANDIDATE_LIMIT_CAP',
  'RECOMMENDATIONS_BRIDGE_CANDIDATE_LIMIT_CAP',
  'RECOMMENDATIONS_BASKET_CAP',
];

const ENV_ONLY_KEYS = [...CRON_KEYS, ...CAP_KEYS];

const byKey = new Map(descriptors.settings.map((d) => [d.key, d]));
const covered = [
  ...descriptors.settings.flatMap((s) => s.env),
  ...(descriptors.envOnly ?? []).map((e) => e.key),
];

test('cubre las 20 variables auditadas, ni una más ni una menos', () => {
  const expected = [...MANAGED_KEYS, ...ENV_ONLY_KEYS].sort();
  assert.equal(expected.length, 20);
  assert.deepEqual(
    [...covered].sort(),
    expected,
    'el descriptor y la auditoría discrepan: si agregaste una env var, actualizá las dos listas',
  );
});

test('las doce gestionadas son de INSTANCIA, ninguna de tienda', () => {
  // Ningún call site del motor tiene una `SiteResolution`: los jobs recorren todas
  // las tiendas en una pasada, el rate limit es un Map por proceso y el kill switch
  // se lee desde subscribers sin request. Declarar `site` acá no habilitaría nada y
  // sí activaría el fail-closed: la tienda B quedaría con el motor apagado sin un
  // solo error en los logs. Lo que sí varía por tienda vive en `store_setting`.
  for (const d of descriptors.settings) {
    assert.equal(d.scope, 'instance', `${d.key} debería ser instance`);
  }
});

test('los cuatro cron son envOnly: el schedule se hornea al arrancar', () => {
  // `job-loader.js:69-78` lee `config.schedule` al evaluar el archivo del job, antes
  // de que exista el contenedor y por lo tanto antes de que exista la base. Una
  // perilla en el admin que no se puede aplicar es peor que no tener perilla.
  for (const key of CRON_KEYS) {
    assert.equal(byKey.get(key), undefined, `${key} no puede tener descriptor`);
  }
});

test('los cuatro topes duros son envOnly: el guardia no vive adentro de la caja', () => {
  // Acotan `default_result_limit`, `default_candidate_limit` y `max_basket_size`, que
  // el merchant edita en /recomendaciones/configuracion. Un tope editable desde la
  // misma pantalla que acota no acota nada — y estos existen por el incidente del
  // 2026-07-23, en el que el motor clavó el vCPU compartido con el HTTP server.
  for (const key of CAP_KEYS) {
    assert.equal(byKey.get(key), undefined, `${key} no puede tener descriptor`);
  }
});

test('cada envOnly explica POR QUÉ, no sólo QUE', () => {
  assert.deepEqual(
    (descriptors.envOnly ?? []).map((e) => e.key).sort(),
    [...ENV_ONLY_KEYS].sort(),
  );
  for (const entry of descriptors.envOnly ?? []) {
    assert.ok(entry.reason.trim().length > 40, `${entry.key}: la razón es demasiado corta`);
  }
});

test('el secreto de firma es el único `secret`, y no tiene default', () => {
  // Un secreto con default queda en claro en el código Y en el bundle del admin, que
  // importa los descriptores. El fallback real —`COOKIE_SECRET`— vive en
  // `serve/request-token.ts` y es del core, no de esta extensión.
  const secrets = descriptors.settings.filter((d) => d.type === 'secret').map((d) => d.key);
  assert.deepEqual(secrets, ['RECOMMENDATIONS_EVENT_SECRET']);
  assert.equal(byKey.get('RECOMMENDATIONS_EVENT_SECRET')?.default, undefined);
});

test('los tres kill switches son booleanos y arrancan en el estado de hoy', () => {
  // Instalar la extensión no puede cambiar el comportamiento: hasta ahora el motor y
  // los jobs venían prendidos salvo `=false` explícito, y el debug apagado.
  assert.equal(byKey.get('RECOMMENDATIONS_ENABLED')?.default, true);
  assert.equal(byKey.get('RECOMMENDATIONS_JOBS_ENABLED')?.default, true);
  assert.equal(byKey.get('RECOMMENDATIONS_DEBUG')?.default, false);
  for (const key of ['RECOMMENDATIONS_ENABLED', 'RECOMMENDATIONS_JOBS_ENABLED', 'RECOMMENDATIONS_DEBUG']) {
    assert.equal(byKey.get(key)?.type, 'boolean', `${key} debería ser boolean`);
  }
});

test('los pisos del runtime son LOS MISMOS que los `min` del descriptor', () => {
  // El `min` lo hace cumplir `coerceAndValidate` al escribir desde el admin, pero
  // `coerceFromEnv` documenta que NO valida rangos: un `RECOMMENDATIONS_PURGE_BATCH=1`
  // en el panel de deploy sólo lo frena el piso de `settings.ts`. Si divergen, la card
  // promete un mínimo y el runtime aplica otro.
  const pairs: [string, number][] = [
    ['RECOMMENDATIONS_RATE_LIMIT_PER_MINUTE', RECOMMENDATIONS_FLOORS.rateLimitPerMinute],
    ['RECOMMENDATIONS_CONFIG_TTL_MS', RECOMMENDATIONS_FLOORS.configCacheTtlMs],
    ['RECOMMENDATIONS_BUILD_MAX_MS', RECOMMENDATIONS_FLOORS.buildMaxMs],
    ['RECOMMENDATIONS_BUILD_BATCH', RECOMMENDATIONS_FLOORS.buildBatch],
    ['RECOMMENDATIONS_STALE_MINUTES', RECOMMENDATIONS_FLOORS.staleMinutes],
    ['RECOMMENDATIONS_AGGREGATE_LOOKBACK_HOURS', RECOMMENDATIONS_FLOORS.aggregateLookbackHours],
    ['RECOMMENDATIONS_PURGE_BATCH', RECOMMENDATIONS_FLOORS.purgeBatch],
    ['RECOMMENDATIONS_PURGE_MAX_BATCHES', RECOMMENDATIONS_FLOORS.purgeMaxBatches],
  ];
  for (const [key, floor] of pairs) {
    assert.equal(byKey.get(key)?.min, floor, `${key}: el min del descriptor y el piso del runtime no coinciden`);
  }
  // Y que no haya quedado ningún numérico sin piso declarado de los dos lados.
  const numeric = descriptors.settings.filter((d) => d.type === 'number').map((d) => d.key);
  assert.deepEqual(numeric.sort(), pairs.map(([key]) => key).sort());
});

test('la ventana de corrida colgada es holgadamente mayor que el presupuesto por corrida', () => {
  // Si el default de "sin progreso" fuese menor o igual que el presupuesto, el drainer
  // marcaría como colgadas corridas que estaban avanzando bien y las estrategias
  // grandes no terminarían nunca.
  const staleMs = (byKey.get('RECOMMENDATIONS_STALE_MINUTES')!.default as number) * 60_000;
  const budgetMs = byKey.get('RECOMMENDATIONS_BUILD_MAX_MS')!.default as number;
  assert.ok(staleMs > budgetMs * 3, `stale (${staleMs} ms) tiene que ser holgadamente mayor que el presupuesto (${budgetMs} ms)`);

  // Y lo mismo para el TECHO: alguien que suba el presupuesto al máximo no puede
  // quedar por encima del mínimo configurable de la ventana de colgado.
  const staleMinMs = byKey.get('RECOMMENDATIONS_STALE_MINUTES')!.min! * 60_000;
  const budgetMaxMs = byKey.get('RECOMMENDATIONS_BUILD_MAX_MS')!.max!;
  assert.ok(staleMinMs > budgetMaxMs, 'con los extremos configurables el drainer se mataría a sí mismo');
});

test('cada default pasa su propia validación', () => {
  // Un default inválido anda hasta que alguien abre la card, guarda sin tocar nada y
  // se come un 400 inexplicable.
  for (const d of descriptors.settings) {
    if (d.default === undefined) continue;
    if (d.type === 'number' && typeof d.default === 'number') {
      if (d.min !== undefined) assert.ok(d.default >= d.min, `${d.key}: default < min`);
      if (d.max !== undefined) assert.ok(d.default <= d.max, `${d.key}: default > max`);
      if (d.step !== undefined) {
        assert.ok(d.default % d.step === 0, `${d.key}: el default no cae en un paso del input`);
      }
    }
    if ((d.type === 'string' || d.type === 'text') && d.pattern && typeof d.default === 'string') {
      assert.match(d.default, new RegExp(d.pattern), `${d.key}: default no matchea pattern`);
    }
  }
});

test('ningún descriptor declara la misma env var que otro', () => {
  const seen = new Map<string, string>();
  for (const d of descriptors.settings) {
    for (const envVar of d.env) {
      assert.equal(seen.get(envVar), undefined, `${envVar} lo declaran ${seen.get(envVar)} y ${d.key}`);
      seen.set(envVar, d.key);
    }
  }
});

test('invariantes de forma: key UPPER_SNAKE, namespace, label, group y env', () => {
  for (const d of descriptors.settings) {
    assert.match(d.key, /^[A-Z][A-Z0-9_]*$/, `key inválida: ${d.key}`);
    assert.equal(d.namespace, 'extension:recommendation-engine', `${d.key}: namespace desalineado`);
    assert.ok(d.label.trim().length > 0, `${d.key}: sin label`);
    assert.ok(d.help && d.help.trim().length > 30, `${d.key}: el help no explica nada`);
    assert.ok(d.group.trim().length > 0, `${d.key}: sin group`);
    assert.deepEqual(d.env, [d.key], `${d.key}: no hay alias reales en este namespace`);
    assert.equal(d.tier, 'runtime', `${d.key}: los tiers boot van en envOnly, no acá`);
  }
});

test('la card se puede leer: ningún grupo con más de 8 campos', () => {
  const counts = new Map<string, number>();
  for (const d of descriptors.settings) counts.set(d.group, (counts.get(d.group) ?? 0) + 1);
  for (const [group, count] of counts) {
    assert.ok(count <= 8, `el grupo "${group}" tiene ${count} campos: partilo`);
  }
  // Los cuatro grupos son los que la página de admin reparte en dos cards.
  assert.deepEqual(
    [...counts.keys()].sort(),
    ['Estado', 'Recálculo', 'Retención y métricas', 'Servicio'],
  );
});
