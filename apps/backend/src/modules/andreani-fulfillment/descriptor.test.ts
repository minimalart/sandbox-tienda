import { test } from 'node:test';
import assert from 'node:assert/strict';
import descriptors from '../app-settings/descriptors/andreani.ts';
import { ANDREANI_DEFAULTS } from './env-options.ts';

/**
 * El contrato de env vars de Andreani, congelado.
 *
 * `manifest-drift.test.ts` sólo mira los namespaces que están en
 * `descriptors/index.ts`, y `extension:andreani` todavía está en
 * `PENDING_NAMESPACES` porque el ensamblado (index + `component-metadata.js` +
 * sacarlo de la lista) va en otro paso. Hasta que eso pase, este archivo es lo que
 * impide que el descriptor se desalinee, y replica los invariantes que ese test va
 * a exigir el día que se conecte.
 *
 * La lista de abajo es LA lista: 27 variables auditadas con ripgrep sobre
 * `modules/andreani-fulfillment`, `jobs/sync-andreani-tracking-status.ts`,
 * `subscribers/andreani-order.ts` y `workflows/andreani-generate-tickets.ts`. El
 * manifest declaraba 7.
 */

/** Las 23 que pueden variar por tienda. */
const SITE_KEYS = [
  // Credenciales (capa de instancia; la de tienda vive en `site_credential`)
  'ANDREANI_USERNAME',
  'ANDREANI_PASSWORD',
  'ANDREANI_CONTRACT',
  'ANDREANI_CLIENT_CODE',
  // Contratos por servicio
  'ANDREANI_DOMICILIO_CONTRACT_OVERRIDE',
  'ANDREANI_SUCURSAL_CONTRACT_OVERRIDE',
  'ANDREANI_PUNTO_DE_TERCERO_CONTRACT_OVERRIDE',
  // Remitente
  'ANDREANI_SENDER_NAME',
  'ANDREANI_SENDER_EMAIL',
  'ANDREANI_SENDER_PHONE',
  'ANDREANI_SENDER_DOC_TYPE',
  'ANDREANI_SENDER_DOC_NUMBER',
  // Origen
  'ANDREANI_ORIGIN_POSTAL_CODE',
  'ANDREANI_ORIGIN_STREET',
  'ANDREANI_ORIGIN_NUMBER',
  'ANDREANI_ORIGIN_CITY',
  'ANDREANI_ORIGIN_PROVINCE',
  // Bultos
  'ANDREANI_DIMENSION_FALLBACK_ENABLED',
  'ANDREANI_DIMENSION_FALLBACK_LENGTH',
  'ANDREANI_DIMENSION_FALLBACK_WIDTH',
  'ANDREANI_DIMENSION_FALLBACK_HEIGHT',
  'ANDREANI_DIMENSION_FALLBACK_WEIGHT',
  // Operación
  'ANDREANI_AUTO_FULFILL',
];

/** Las 4 de la instancia. La última es `envOnly`. */
const INSTANCE_KEYS = [
  'ANDREANI_HOSTNAME',
  'ANDREANI_TEST_MODE',
  'ANDREANI_TRACKING_BUSINESS_HOURS_ONLY',
];
const ENV_ONLY_KEYS = ['ANDREANI_TRACKING_SYNC_SCHEDULE'];

const byKey = new Map(descriptors.settings.map((d) => [d.key, d]));
const covered = [
  ...descriptors.settings.flatMap((s) => s.env),
  ...(descriptors.envOnly ?? []).map((e) => e.key),
];

test('cubre las 27 variables auditadas, ni una más ni una menos', () => {
  const expected = [...SITE_KEYS, ...INSTANCE_KEYS, ...ENV_ONLY_KEYS].sort();
  assert.equal(expected.length, 27);
  assert.deepEqual(
    [...covered].sort(),
    expected,
    'el descriptor y la auditoría discrepan: si agregaste una env var, actualizá las dos listas',
  );
});

test('el reparto de scope es 23 site / 4 instance', () => {
  // Elegir `site` para algo que es de instancia deja a las tiendas secundarias sin
  // valor por fail-closed, y el síntoma es "no anda en la tienda B" sin ningún error.
  for (const key of SITE_KEYS) {
    assert.equal(byKey.get(key)?.scope, 'site', `${key} debería ser site`);
  }
  for (const key of INSTANCE_KEYS) {
    assert.equal(byKey.get(key)?.scope, 'instance', `${key} debería ser instance`);
  }
  assert.equal(descriptors.settings.filter((d) => d.scope === 'site').length, 23);
  assert.equal(descriptors.settings.filter((d) => d.scope === 'instance').length, 3);
});

test('el cron es lo ÚNICO envOnly, y con razón escrita', () => {
  // `job-loader.js:69-78` hornea el schedule al arrancar: un valor en base no se
  // podría aplicar sin reiniciar. Todo lo demás sí se gestiona desde el admin.
  assert.deepEqual(
    (descriptors.envOnly ?? []).map((e) => e.key),
    ENV_ONLY_KEYS,
  );
  for (const entry of descriptors.envOnly ?? []) {
    assert.ok(entry.reason.trim().length > 40, `${entry.key}: la razón es demasiado corta`);
  }
});

test('sólo la contraseña es `secret`, y no tiene default', () => {
  // Un secreto con default quedaría en claro en el código. El usuario y el contrato
  // NO son secretos: se muestran en la card y se pueden leer del entorno.
  const secrets = descriptors.settings.filter((d) => d.type === 'secret').map((d) => d.key);
  assert.deepEqual(secrets, ['ANDREANI_PASSWORD']);
  assert.equal(byKey.get('ANDREANI_PASSWORD')?.default, undefined);
});

test('las tres credenciales que hacen falta para autenticar están marcadas `required`', () => {
  for (const key of ['ANDREANI_USERNAME', 'ANDREANI_PASSWORD', 'ANDREANI_CONTRACT']) {
    assert.equal(byKey.get(key)?.required, true, `${key} debería ser required`);
  }
  // El código de cliente NO: hay contratos que lo ignoran.
  assert.notEqual(byKey.get('ANDREANI_CLIENT_CODE')?.required, true);
});

test('cada default pasa su propia validación', () => {
  // Un default inválido anda hasta que alguien abre la card, guarda sin tocar nada y
  // se come un 400 inexplicable.
  for (const d of descriptors.settings) {
    if (d.default === undefined) continue;
    if (d.type === 'number' && typeof d.default === 'number') {
      if (d.min !== undefined) assert.ok(d.default >= d.min, `${d.key}: default < min`);
      if (d.max !== undefined) assert.ok(d.default <= d.max, `${d.key}: default > max`);
    }
    if ((d.type === 'string' || d.type === 'text') && d.pattern && typeof d.default === 'string') {
      assert.match(d.default, new RegExp(d.pattern), `${d.key}: default no matchea pattern`);
    }
    // Un enum cuyo default no está entre sus opciones es la versión más tonta del
    // mismo bug: el select abre sin nada seleccionado y `coerceEnum` rechaza el
    // valor que el propio descriptor propone.
    if (d.type === 'enum') {
      const allowed = (d.options ?? []).map((o) => o.value);
      assert.ok(allowed.length > 0, `${d.key}: enum sin opciones`);
      assert.ok(
        allowed.includes(String(d.default)),
        `${d.key}: el default no está entre las opciones`,
      );
    }
  }
});

/**
 * El entorno de Andreani se ELIGE, no se escribe.
 *
 * `ANDREANI_HOSTNAME` era texto libre con default `apisqa.andreani.com`: una
 * instalación productiva que no seteaba nada despachaba contra QA, y para darse
 * cuenta había que saber qué significa "apisqa". Con dos opciones etiquetadas, la
 * card muestra cuál está activa y no hay forma de guardar un tercer valor por
 * error. Ver la nota 3 del encabezado del descriptor.
 */
test('el entorno de Andreani es un enum de dos opciones, etiquetadas sin ambigüedad', () => {
  const hostname = byKey.get('ANDREANI_HOSTNAME');
  assert.equal(hostname?.type, 'enum', 'texto libre esconde a qué entorno se le pega');
  assert.deepEqual(
    (hostname?.options ?? []).map((o) => o.value),
    ['apisqa.andreani.com', 'apis.andreani.com'],
  );

  // Las etiquetas son la mitad del arreglo: `apisqa.andreani.com` a secas no le
  // dice nada a quien no conoce la nomenclatura de Andreani.
  const [qa, prod] = hostname!.options!;
  assert.match(qa!.label, /prueba|qa/i, 'la opción de QA tiene que decir que es de prueba');
  assert.match(prod!.label, /producc/i, 'la opción productiva tiene que decir que es real');

  // El default NO se movió a producción: hacerlo mandaría a facturar contra el
  // contrato real a toda instalación de prueba que hoy no setea la variable.
  assert.equal(hostname?.default, 'apisqa.andreani.com');
});

test('los patterns aceptan los valores reales que la gente carga', () => {
  const matches = (key: string, value: string) =>
    new RegExp(byKey.get(key)!.pattern!).test(value);

  assert.ok(matches('ANDREANI_ORIGIN_POSTAL_CODE', '1414'));
  assert.ok(matches('ANDREANI_ORIGIN_POSTAL_CODE', 'C1414AAB'), 'un CPA argentino es válido');
  assert.ok(!matches('ANDREANI_ORIGIN_POSTAL_CODE', 'Buenos Aires'));

  assert.ok(matches('ANDREANI_SENDER_DOC_NUMBER', '30123456789'));
  assert.ok(!matches('ANDREANI_SENDER_DOC_NUMBER', '30-12345678-9'), 'sin guiones');

  assert.ok(matches('ANDREANI_SENDER_EMAIL', 'envios@mi-tienda.com'));
  assert.ok(!matches('ANDREANI_SENDER_EMAIL', 'no es un mail'));

  // `ANDREANI_HOSTNAME` ya no tiene pattern: pasó a ser un enum, así que la
  // validación es "está entre las opciones" y la cubre el test de más abajo. El
  // pattern viejo (`^[A-Za-z0-9.-]+$`) sólo garantizaba que no se pegara el
  // `https://`, que era la mitad del problema — el host equivocado también
  // matcheaba.
  assert.equal(byKey.get('ANDREANI_HOSTNAME')?.pattern, undefined);
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
    assert.equal(d.namespace, 'extension:andreani', `${d.key}: namespace desalineado`);
    assert.ok(d.label.trim().length > 0, `${d.key}: sin label`);
    assert.ok(d.group.trim().length > 0, `${d.key}: sin group`);
    assert.ok(d.env.length > 0, `${d.key}: sin env var de la que heredar`);
    assert.equal(d.tier, 'runtime', `${d.key}: los tiers boot van en envOnly, no acá`);
  }
});

test('la card se puede leer: ningún grupo con más de 8 campos', () => {
  const counts = new Map<string, number>();
  for (const d of descriptors.settings) counts.set(d.group, (counts.get(d.group) ?? 0) + 1);
  for (const [group, count] of counts) {
    assert.ok(count <= 8, `el grupo "${group}" tiene ${count} campos: partilo`);
  }
});

test('los defaults del descriptor y los del normalizador son LOS MISMOS', () => {
  // El default vive en dos lados porque cumple dos funciones: la UI lo necesita como
  // DATO (para dibujar el input y mostrar lo heredado en gris) y `normalizeAndreaniOptions`
  // lo necesita como piso en runtime. Que puedan divergir es el precio; este test es
  // lo que lo cobra. Si divergen, la card muestra 30 cm y el envío sale con otra cosa.
  assert.equal(byKey.get('ANDREANI_HOSTNAME')?.default, ANDREANI_DEFAULTS.hostname);
  assert.equal(byKey.get('ANDREANI_SENDER_NAME')?.default, ANDREANI_DEFAULTS.senderName);
  assert.equal(
    byKey.get('ANDREANI_DIMENSION_FALLBACK_LENGTH')?.default,
    ANDREANI_DEFAULTS.dimensionFallback.length,
  );
  assert.equal(
    byKey.get('ANDREANI_DIMENSION_FALLBACK_WIDTH')?.default,
    ANDREANI_DEFAULTS.dimensionFallback.width,
  );
  assert.equal(
    byKey.get('ANDREANI_DIMENSION_FALLBACK_HEIGHT')?.default,
    ANDREANI_DEFAULTS.dimensionFallback.height,
  );
  assert.equal(
    byKey.get('ANDREANI_DIMENSION_FALLBACK_WEIGHT')?.default,
    ANDREANI_DEFAULTS.dimensionFallback.weight,
  );
});
