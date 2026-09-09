import { test } from 'node:test';
import assert from 'node:assert/strict';
import descriptors from '../app-settings/descriptors/multistore.ts';
import { __resetSnapshot, replaceSnapshot } from '../app-settings/snapshot.ts';
import { getMultistoreSettings } from './settings.ts';

/**
 * El contrato de env vars de Multitienda, congelado.
 *
 * Las 4 originales salieron de un ripgrep sobre lo que `resolve-ownership.js` le
 * asigna a `multistore`: `modules/demo-store`, `api/admin/sites`,
 * `api/store/sites`, `admin/routes/sites` y los tres links. El manifest declaraba
 * CERO. La quinta —`MULTISTORE_PUBLIC_BASE_URL`— no salió de ningún ripgrep: es
 * nueva, se creó para que el dominio del link público se pueda corregir desde el
 * admin, y el porqué de que sea nueva en vez de `STOREFRONT_URL` editable está en
 * el descriptor.
 *
 * `manifest-drift.test.ts` ya cubre los invariantes genéricos —el namespace está
 * en `descriptors/index.ts` y su `environment[]` cierra—, así que lo que queda acá
 * es lo ESPECÍFICO: qué claves son, de qué forma es cada una y con qué defaults
 * resuelve el lector. Es el archivo que se rompe cuando alguien agrega una clave
 * al descriptor sin pensar de qué tipo tiene que ser.
 */

/** Las que se gestionan desde el admin. */
const MANAGED_KEYS = [
  'DEMO_IMPORT_STALE_MS',
  'DEMO_IMPORT_THROTTLE_MS',
  'DEMO_IMPORT_BACKOFF_BASE_MS',
  'MULTISTORE_PUBLIC_BASE_URL',
];

/**
 * Las dos perillas del importador. Subconjunto de `MANAGED_KEYS` porque comparten
 * forma —número de instancia, con default y rango— y la de la URL no: separarlas
 * es lo que evita que el test de forma se afloje a "lo que todas tengan en común".
 */
const NUMBER_KEYS = ['DEMO_IMPORT_THROTTLE_MS', 'DEMO_IMPORT_BACKOFF_BASE_MS'];

/** Las 2 que son de MercadoPago: acá sólo se leen. */
const ENV_ONLY_KEYS = ['MERCADOPAGO_ACCOUNTS', 'MERCADOPAGO_PUBLIC_KEY'];

const byKey = new Map(descriptors.settings.map((d) => [d.key, d]));

test('Tiendas incluye los ajustes y variables del importador', () => {
  assert.deepEqual([...byKey.keys()].sort(), [...MANAGED_KEYS].sort());
  assert.deepEqual((descriptors.envOnly ?? []).map((e) => e.key).sort(), [...ENV_ONLY_KEYS, 'APPLY', 'DEFAULT_CURRENCY_CODE', 'DEMO_IMPORT_CRON', 'DEMO_SLUG'].sort());
});

test('las dos del importador son números de instancia con default y rango', () => {
  for (const key of NUMBER_KEYS) {
    const d = byKey.get(key)!;
    assert.equal(d.type, 'number', `${key}: type`);
    assert.equal(d.tier, 'runtime', `${key}: se lee en cada request saliente, no en el boot`);
    // `instance` porque el portón de throttling es un `let` de módulo, uno por
    // proceso: un valor por tienda no tendría dónde aplicarse, y el fail-closed
    // dejaría a las secundarias sin ninguno.
    assert.equal(d.scope, 'instance', `${key}: scope`);
    assert.equal(typeof d.default, 'number', `${key}: sin default`);
    assert.ok(d.min !== undefined && d.max !== undefined, `${key}: sin rango`);
    assert.ok((d.default as number) >= d.min! && (d.default as number) <= d.max!, `${key}: default fuera de rango`);
  }
  // 0 tiene que ser un valor LEGAL en el throttle: es cómo se apaga.
  assert.equal(byKey.get('DEMO_IMPORT_THROTTLE_MS')!.min, 0);
});

test('la base pública es una URL de instancia y SIN default', () => {
  const d = byKey.get('MULTISTORE_PUBLIC_BASE_URL')!;

  // `url` y no `string`: `validate.ts` exige absoluta y http(s). Una base relativa
  // o un `ftp://` acá producen un `href` roto en cada fila del listado de tiendas.
  assert.equal(d.type, 'url');
  assert.equal(d.tier, 'runtime');

  // `instance`: las tiendas cuelgan de esta base con `/tienda/<slug>`, no la eligen.
  // Un `scope: 'site'` haría que la secundaria sin valor propio quede sin base por
  // fail-closed — el link del listado apuntando a localhost y ningún error.
  assert.equal(d.scope, 'instance');

  // SIN default, y es el invariante que sostiene toda la compatibilidad hacia atrás:
  // un default acá le ganaría a `STOREFRONT_URL` y a `STORE_CORS` en TODA instalación
  // que no haya tocado la card, o sea que este cambio movería links que hoy andan.
  // Vacío = el handler sigue de largo a los escalones de siempre.
  assert.equal(d.default, undefined);
});

test('las de MercadoPago apuntan a su dueño, no dicen sólo "no se puede"', () => {
  // La regla de propiedad de esta migración: una variable la EDITA un solo namespace
  // y los demás la declaran en envOnly nombrando al dueño. Un `reason` que dice
  // "no se gestiona desde acá" sin decir dónde sí es una pared, no una explicación.
  for (const key of ENV_ONLY_KEYS) {
    const entry = (descriptors.envOnly ?? []).find((e) => e.key === key)!;
    assert.match(entry.reason, /MercadoPago/, `${key}: la razón no nombra al dueño`);
  }
});

test('sin fila ni env, se usan los mismos defaults que tenía el código', () => {
  // Byte por byte lo que hacía `Number(process.env.DEMO_IMPORT_THROTTLE_MS ?? 200)`.
  // Si estos dos números cambian, cambia el ritmo de todas las importaciones.
  __resetSnapshot();
  delete process.env.DEMO_IMPORT_THROTTLE_MS;
  delete process.env.DEMO_IMPORT_BACKOFF_BASE_MS;

  assert.deepEqual(getMultistoreSettings(), {
    importThrottleMs: 200,
    importBackoffBaseMs: 1000,
  });
});

test('la fila de site_setting le gana a la env var', () => {
  process.env.DEMO_IMPORT_THROTTLE_MS = '500';
  replaceSnapshot([
    {
      namespace: 'extension:multistore',
      key: 'DEMO_IMPORT_THROTTLE_MS',
      value: 900,
      ciphertext: null,
      is_secret: false,
    },
  ] as never);

  assert.equal(getMultistoreSettings().importThrottleMs, 900);

  // Sin fila se vuelve al env: el fallback sigue vivo, no hay seed.
  __resetSnapshot();
  assert.equal(getMultistoreSettings().importThrottleMs, 500);
  delete process.env.DEMO_IMPORT_THROTTLE_MS;
});

test('un 0 en el env se respeta: es cómo se apaga el throttle', () => {
  // El clásico bug de `value || default`: con `||`, un 0 legítimo se convertiría en
  // 200 y el throttle quedaría prendido justo cuando alguien lo apagó a propósito.
  // Los tests de importadores del repo se apoyan en esto (`DEMO_IMPORT_THROTTLE_MS=0`).
  __resetSnapshot();
  process.env.DEMO_IMPORT_THROTTLE_MS = '0';
  assert.equal(getMultistoreSettings().importThrottleMs, 0);
  delete process.env.DEMO_IMPORT_THROTTLE_MS;
});

test('un valor basura cae al default en vez de romper la importación', () => {
  // `coerceFromEnv` convierte pero NO valida rangos, a propósito. Un `NaN` acá se
  // traduce en `sleep(NaN)` y un negativo en un backoff que no espera nada y martilla
  // a la fuente hasta que corta: el default vale más que un valor roto.
  __resetSnapshot();
  process.env.DEMO_IMPORT_THROTTLE_MS = 'muy rápido';
  process.env.DEMO_IMPORT_BACKOFF_BASE_MS = '-5000';

  assert.equal(getMultistoreSettings().importThrottleMs, 200);
  assert.equal(getMultistoreSettings().importBackoffBaseMs, 1000);

  delete process.env.DEMO_IMPORT_THROTTLE_MS;
  delete process.env.DEMO_IMPORT_BACKOFF_BASE_MS;
});
