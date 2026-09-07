import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import descriptors from '../app-settings/descriptors/corporate.ts';
import {
  CORPORATE_SETTINGS_NAMESPACE,
  getCorporateSettings,
  resolveWholesaleDiscount,
} from './settings.ts';

/**
 * El snapshot de `app-settings` arranca vacío en los tests (no hay base), así que
 * lo que se ejercita es el tramo **env > default** del resolver — que es
 * exactamente el comportamiento que esta migración tenía que preservar. La capa
 * de DB ya está cubierta por `app-settings/precedence.test.ts`.
 */

const ENV_KEYS = [
  'CORPORATE_ACTIVATION_MODE',
  'WHOLESALE_DISCOUNT',
  'WHOLESALE_PRICE_LIST_TITLE',
  'APP_SETTINGS_DISABLE',
];

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

test('el namespace es el que declara el manifest de la extensión', () => {
  assert.equal(CORPORATE_SETTINGS_NAMESPACE, 'extension:corporate');
});

test('sin nada configurado, los defaults son los que ya tenía el código', () => {
  // Si esto cambia, cambia el comportamiento de toda instalación existente en el
  // deploy: alta manual, 20% de descuento y el título que hace de idempotencia.
  const settings = getCorporateSettings();
  assert.equal(settings.activationMode, 'manual');
  assert.equal(settings.wholesaleDiscount, 0.2);
  assert.equal(settings.wholesalePriceListTitle, 'Mayorista -20%');
});

test('el env sigue mandando cuando no hay fila', () => {
  process.env.CORPORATE_ACTIVATION_MODE = 'automatic';
  process.env.WHOLESALE_DISCOUNT = '0.35';
  process.env.WHOLESALE_PRICE_LIST_TITLE = 'Mayorista Q1';

  const settings = getCorporateSettings();
  assert.equal(settings.activationMode, 'automatic');
  assert.equal(settings.wholesaleDiscount, 0.35);
  assert.equal(settings.wholesalePriceListTitle, 'Mayorista Q1');
});

/**
 * La regla que impide que una empresa quede operando sin que nadie la aprobara.
 * `coerceFromEnv` NO valida contra `options` a propósito, así que por el entorno
 * puede entrar cualquier cosa; la activación automática tiene que exigir el
 * literal exacto, igual que la ruta antes de la migración.
 */
test('sólo el literal "automatic" activa sola: todo lo demás cae a manual', () => {
  for (const raw of ['Automatic', 'AUTOMATIC', 'auto', 'true', '1', 'si', 'automatico']) {
    process.env.CORPORATE_ACTIVATION_MODE = raw;
    assert.equal(
      getCorporateSettings().activationMode,
      'manual',
      `"${raw}" activó empresas sin aprobación`,
    );
  }
});

test('CAMBIO DE COMPORTAMIENTO: los espacios de más ya no invalidan el valor', () => {
  // Antes la ruta comparaba el crudo (`=== 'automatic'`), así que ' automatic '
  // caía a manual. Ahora `coerceFromEnv` recorta, y esto queda escrito para que
  // el cambio sea una decisión y no una sorpresa: un espacio pegado al copiar en
  // un panel de deploy dejaba la extensión en un modo que nadie eligió, y el
  // síntoma era "puse automatic y sigue pidiendo aprobación".
  process.env.CORPORATE_ACTIVATION_MODE = '  automatic  ';
  assert.equal(getCorporateSettings().activationMode, 'automatic');
});

test('el descriptor de activación ofrece exactamente los dos modos del tipo', () => {
  // Un `options` que se desalinee del union `CorporateActivationMode` produce una
  // opción elegible en la card que el código traduce en silencio a 'manual'.
  const activation = descriptors.settings.find((d) => d.key === 'CORPORATE_ACTIVATION_MODE');
  assert.deepEqual(
    (activation?.options ?? []).map((o) => o.value),
    ['manual', 'automatic'],
  );
});

/* -------------------------------------------------------------------------- */
/* Descuento mayorista: el número que toca plata                               */
/* -------------------------------------------------------------------------- */

test('el descuento se recorta al rango del descriptor', () => {
  // El `min`/`max` lo hace cumplir la card y NADIE MÁS: por el env entra
  // cualquier cosa. Un 1 deja la lista mayorista a precio CERO y el script la
  // crea activa sin decir nada.
  assert.equal(resolveWholesaleDiscount(1), 0.9);
  assert.equal(resolveWholesaleDiscount(12), 0.9);
  assert.equal(resolveWholesaleDiscount(-0.5), 0);
});

test('un descuento no numérico cae al default en vez de propagar NaN', () => {
  // `Math.round(cur * (1 - NaN) * 100) / 100` es NaN, y el workflow de price
  // lists lo aceptaría sin chistar.
  assert.equal(resolveWholesaleDiscount(Number.NaN), 0.2);
  assert.equal(resolveWholesaleDiscount(Number.POSITIVE_INFINITY), 0.2);
});

test('un descuento válido pasa intacto', () => {
  assert.equal(resolveWholesaleDiscount(0.2), 0.2);
  assert.equal(resolveWholesaleDiscount(0.45), 0.45);
  assert.equal(resolveWholesaleDiscount(0), 0);
});

test('resolveWholesaleDiscount sin argumento lee la configuración efectiva', () => {
  process.env.WHOLESALE_DISCOUNT = 'veinte por ciento';
  assert.equal(resolveWholesaleDiscount(), 0.2, 'un env basura tiene que caer al default');
});
