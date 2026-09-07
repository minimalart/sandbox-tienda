import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAndreaniSiteCredentials,
  normalizeAndreaniOptions,
  resolveContractForService,
} from './env-options.ts';
import type { AndreaniProviderOptions } from './types.ts';

/**
 * `env-options.ts` es ahora la ÚNICA normalización de Andreani: antes la mitad
 * vivía acá y la otra mitad era un `private static` del provider, así que sólo se
 * podía testear instanciándolo con un container de Medusa. Esto es lo que se gana
 * al mudarla.
 *
 * Las tres funciones se testean con `base` explícita: sin eso dependerían del
 * snapshot de `app-settings` y de `process.env`, y un test que depende del entorno
 * de quien lo corre no vale nada.
 */

const base: AndreaniProviderOptions = {
  hostname: 'apis.andreani.com',
  username: 'usuario-instancia',
  password: 'pass-instancia',
  contract: '400000000',
  clientCode: 'CLI-1',
  testMode: false,
  sender: {
    name: 'Tienda Instancia',
    email: 'envios@instancia.com',
    phone: '1100000000',
    documentType: 'CUIT',
    documentNumber: '30123456789',
  },
  origin: {
    postalCode: '1414',
    street: 'Corrientes',
    number: '1234',
    city: 'CABA',
    province: 'Buenos Aires',
  },
  dimensionFallback: { enabled: true, length: 30, width: 20, height: 15, weight: 0.5 },
};

/* -------------------------------------------------------------------------- */
/* normalizeAndreaniOptions                                                    */
/* -------------------------------------------------------------------------- */

test('sin credenciales NO tira: el backend tiene que arrancar igual', () => {
  // LA razón de existir de este cambio. `medusa-config.ts:455` registra el provider
  // si `ANDREANI_USERNAME` está seteada, pero el normalize viejo exigía además
  // password y contract y LANZABA. Con la contraseña vacía, el provider explotaba
  // en el constructor y el backend entero no levantaba.
  const empty: AndreaniProviderOptions = {
    ...base,
    username: '',
    password: '',
    contract: '',
  };

  assert.doesNotThrow(() => normalizeAndreaniOptions({}, empty));
  const result = normalizeAndreaniOptions({}, empty);
  assert.equal(result.username, '');
  assert.equal(result.password, '');
  assert.equal(result.contract, '');
});

test('sin options, todo sale de la base resuelta', () => {
  assert.deepEqual(normalizeAndreaniOptions(undefined, base), base);
});

test('las options de medusa-config pisan la base, campo por campo', () => {
  const result = normalizeAndreaniOptions(
    {
      username: 'hardcodeado',
      sender: { name: 'Otro Remitente' },
      dimensionFallback: { weight: 2 },
    },
    base,
  );

  assert.equal(result.username, 'hardcodeado');
  assert.equal(result.sender.name, 'Otro Remitente');
  assert.equal(result.dimensionFallback.weight, 2);
  // Lo que las options NO traen sigue viniendo de la base: es lo que permite que la
  // configuración en base gobierne todo lo que nadie hardcodeó.
  assert.equal(result.password, 'pass-instancia');
  assert.equal(result.sender.email, 'envios@instancia.com');
  assert.equal(result.dimensionFallback.length, 30);
});

test('un string vacío en las options NO borra el valor de la base', () => {
  // Las options que llegan de `medusa-config.ts` pueden traer `''` (una variable
  // declarada en blanco en el panel de deploy es lo normal). Si el vacío ganara,
  // borraría en silencio lo que hay en base.
  const result = normalizeAndreaniOptions({ username: '', contract: '   ' }, base);
  assert.equal(result.username, 'usuario-instancia');
  assert.equal(result.contract, '400000000');
});

test("testMode acepta booleano y el string 'true', y cae a la base si no viene", () => {
  assert.equal(normalizeAndreaniOptions({ testMode: true }, base).testMode, true);
  assert.equal(normalizeAndreaniOptions({ testMode: 'true' }, base).testMode, true);
  assert.equal(normalizeAndreaniOptions({ testMode: 'false' }, base).testMode, false);
  assert.equal(
    normalizeAndreaniOptions({}, { ...base, testMode: true }).testMode,
    true,
    'sin la clave en options, manda la base',
  );
});

test('una dimensión en 0 o negativa cae al valor de la base', () => {
  // Un 0 produce volumen 0 y Andreani rechaza el bulto entero.
  const result = normalizeAndreaniOptions(
    { dimensionFallback: { length: 0, width: -5, height: 'nada' } },
    base,
  );
  assert.equal(result.dimensionFallback.length, 30);
  assert.equal(result.dimensionFallback.width, 20);
  assert.equal(result.dimensionFallback.height, 15);
});

/* -------------------------------------------------------------------------- */
/* applyAndreaniSiteCredentials                                                */
/* -------------------------------------------------------------------------- */

test('las credenciales de la tienda pisan las de la instancia', () => {
  const result = applyAndreaniSiteCredentials(base, {
    username: 'usuario-tienda',
    password: 'pass-tienda',
    contract: '500000000',
    clientCode: 'CLI-B',
  });

  assert.equal(result.username, 'usuario-tienda');
  assert.equal(result.password, 'pass-tienda');
  assert.equal(result.contract, '500000000');
  assert.equal(result.clientCode, 'CLI-B');
});

test('una clave ausente o vacía conserva la de la instancia', () => {
  // Con el spread plano que había antes (`{ ...options, ...creds }`), un
  // `{ password: '' }` guardado a mano dejaba al cliente sin contraseña.
  const result = applyAndreaniSiteCredentials(base, { username: 'solo-usuario', password: '  ' });
  assert.equal(result.username, 'solo-usuario');
  assert.equal(result.password, 'pass-instancia');
  assert.equal(result.contract, '400000000');
  assert.equal(result.clientCode, 'CLI-1');
});

test('una clave de más en el blob NO se cuela en las opciones', () => {
  // Con el spread, un `hostname` cargado por error en `site_credential` apuntaba esa
  // tienda a otro entorno de Andreani — y el hostname es config de INSTANCIA.
  const result = applyAndreaniSiteCredentials(base, {
    username: 'usuario-tienda',
    // @ts-expect-error a propósito: es exactamente lo que el tipo tiene que impedir
    hostname: 'apisqa.andreani.com',
    // @ts-expect-error idem
    testMode: true,
  });

  assert.equal(result.hostname, 'apis.andreani.com');
  assert.equal(result.testMode, false);
  assert.equal((result as Record<string, unknown>).hostnameOverride, undefined);
});

test('los valores se trimean: un espacio invisible en la contraseña es un 401 indiagnosticable', () => {
  const result = applyAndreaniSiteCredentials(base, { password: '  secreta  ' });
  assert.equal(result.password, 'secreta');
});

test('un clientCode vacío en la instancia y en la tienda queda undefined, no ""', () => {
  const sinCodigo = { ...base, clientCode: undefined };
  assert.equal(applyAndreaniSiteCredentials(sinCodigo, {}).clientCode, undefined);
  assert.equal(applyAndreaniSiteCredentials(sinCodigo, { clientCode: '  ' }).clientCode, undefined);
});

/* -------------------------------------------------------------------------- */
/* resolveContractForService                                                   */
/* -------------------------------------------------------------------------- */

const noOverrides = { Domicilio: undefined, Sucursal: undefined, PuntoDeTercero: undefined };

test('el override del servicio gana sobre el contrato base', () => {
  assert.equal(
    resolveContractForService('Domicilio', '400000000', {
      ...noOverrides,
      Domicilio: '111111111',
    }),
    '111111111',
  );
});

test('los overrides son POR SERVICIO: el de sucursal no afecta a domicilio', () => {
  const overrides = { ...noOverrides, Sucursal: '222222222' };
  assert.equal(resolveContractForService('Domicilio', '400000000', overrides), '400000000');
  assert.equal(resolveContractForService('Sucursal', '400000000', overrides), '222222222');
});

test('una ETIQUETA en vez de un número de contrato se descarta', () => {
  // Es el error clásico: el operador escribe "Domicilio" creyendo que es un selector
  // de servicio. Andreani lo rechaza y la opción sale en $0.
  for (const label of ['Domicilio', 'a domicilio', 'SUCURSAL', 'punto de tercero']) {
    assert.equal(
      resolveContractForService('Domicilio', '400000000', { ...noOverrides, Domicilio: label }),
      '400000000',
      `"${label}" no debería usarse como contrato`,
    );
  }
});

test('los overrides son un PARÁMETRO: dos tiendas resuelven contratos distintos', () => {
  // El arreglo de fondo. Antes esto leía `process.env` adentro de la función, así que
  // los tres overrides eran inmunes a las credenciales por tienda.
  const tiendaA = { ...noOverrides, Domicilio: 'A-111' };
  const tiendaB = { ...noOverrides, Domicilio: 'B-222' };
  assert.equal(resolveContractForService('Domicilio', 'base', tiendaA), 'A-111');
  assert.equal(resolveContractForService('Domicilio', 'base', tiendaB), 'B-222');
});
