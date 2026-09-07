import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import descriptors from '../app-settings/descriptors/b2b.ts';
import { coerceAndValidate } from '../app-settings/validate.ts';
import { B2B_SETTINGS_NAMESPACE, getB2bSalesChannelId, getB2bSettings } from './settings.ts';

/**
 * Sin base en los tests: se ejercita el tramo **env > default** del resolver.
 *
 * Lo importante acá es la VALIDACIÓN DE FORMA. El canal mayorista decide, vía
 * `company/site-scope.ts`, a qué tienda pertenece una empresa: un ID inválido no
 * tira ningún error, deja la empresa colgada de la tienda equivocada y sus
 * pedidos cotizando con otra lista de precios.
 */

const ENV_KEYS = ['B2B_SALES_CHANNEL_ID', 'APP_SETTINGS_DISABLE'];

/** Un ID real de canal de ventas de Medusa v2: `sc_` + ULID de 26. */
const VALID_ID = 'sc_01KYBDZ85NFZK0F66T1G6ZBAHC';

const descriptor = descriptors.settings.find((d) => d.key === 'B2B_SALES_CHANNEL_ID')!;

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

test('el namespace es el que declara el manifest de la extensión', () => {
  assert.equal(B2B_SETTINGS_NAMESPACE, 'extension:b2b');
});

test('sin canal configurado devuelve null, no undefined ni cadena vacía', () => {
  // Es el mismo `?? null` que tenían las dos rutas: la empresa se crea sin canal
  // y se le asigna después. `''` no matchearía ningún canal Y encima no se vería
  // como "sin asignar" en el listado.
  assert.equal(getB2bSalesChannelId(), null);
  assert.deepEqual(getB2bSettings(), { salesChannelId: null });
});

test('una env definida en blanco cuenta como sin configurar', () => {
  process.env.B2B_SALES_CHANNEL_ID = '   ';
  assert.equal(getB2bSalesChannelId(), null);
});

test('el env sigue mandando cuando no hay fila', () => {
  process.env.B2B_SALES_CHANNEL_ID = VALID_ID;
  assert.equal(getB2bSalesChannelId(), VALID_ID);
});

test('el env NO se valida: una instalación con un valor raro sigue como antes', () => {
  // `coerceFromEnv` no corre `refine` a propósito. Endurecer el env sería romper
  // deploys existentes en el momento del upgrade, que es lo único que esta
  // migración no puede hacer.
  process.env.B2B_SALES_CHANNEL_ID = 'canal-mayorista';
  assert.equal(getB2bSalesChannelId(), 'canal-mayorista');
});

/* -------------------------------------------------------------------------- */
/* Validación al GUARDAR desde el admin                                        */
/* -------------------------------------------------------------------------- */

test('un ID de canal válido se acepta', () => {
  const result = coerceAndValidate(descriptor, VALID_ID);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value, VALID_ID);
});

test('se rechaza lo que la gente pega de verdad en vez del ID', () => {
  // El nombre del canal, el ID de otra entidad, el ID a medio copiar y el ID con
  // el prefijo mal. Ninguno falla solo: todos crean empresas mal asignadas.
  const rejected = [
    'Mayorista',
    'sc_1',
    'pcol_01KYBDZ85NFZK0F66T1G6ZBAHC',
    '01KYBDZ85NFZK0F66T1G6ZBAHC',
    'sc_01kybdz85nfzk0f66t1g6zbahc',
    `${VALID_ID}X`,
  ];
  for (const raw of rejected) {
    const result = coerceAndValidate(descriptor, raw);
    assert.equal(result.ok, false, `"${raw}" pasó la validación`);
  }
});

test('el mensaje de error dice el formato y de dónde sacarlo', () => {
  // La razón de usar `refine` y no `pattern`: `pattern` corta antes con "El
  // formato no es válido", que a alguien que pegó el nombre del canal no le dice
  // absolutamente nada.
  const result = coerceAndValidate(descriptor, 'Mayorista');
  assert.equal(result.ok, false);
  const message = result.ok ? '' : result.error;
  assert.match(message, /sc_/);
  assert.match(message, /Canales de venta/i);
});

test('el ID se guarda recortado', () => {
  const result = coerceAndValidate(descriptor, ` ${VALID_ID} `);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value, VALID_ID);
});

test('el canal es por TIENDA: fail-closed antes que heredar el de otra', () => {
  // `scope: 'site'` a propósito. Con `instance`, todas las tiendas estamparían el
  // canal de una sola — el bug que documenta `company/site-scope.ts`. El
  // fail-closed de una secundaria deja `null`, que es un estado normal.
  assert.equal(descriptor.scope, 'site');
});
