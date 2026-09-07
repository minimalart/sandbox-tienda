import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El provider de Andreani es el primero que consume las credenciales por tienda, y
 * es el que fija el patrón para correo-argentino, mercadopago, kapso y sendgrid.
 *
 * Se verifica sobre el fuente: instanciar el provider o correr el workflow necesita
 * un container de Medusa. Lo que hay que impedir es que alguien "simplifique" el
 * manejo de errores o vuelva a atar un camino al entorno, que es donde están las
 * decisiones que importan.
 */

const HERE = import.meta.dirname;
const SERVICE = readFileSync(join(HERE, 'service.ts'), 'utf8');
const GET_CLIENT = readFileSync(join(HERE, 'get-client.ts'), 'utf8');
const WORKFLOW = readFileSync(
  join(HERE, '..', '..', 'workflows', 'andreani-generate-tickets.ts'),
  'utf8',
);

/**
 * Los asserts NEGATIVOS ("esto ya no puede aparecer") tienen que correr sobre el
 * CÓDIGO, no sobre los comentarios. Estos archivos documentan el bug que arreglaron
 * nombrando la función vieja, así que un `doesNotMatch` contra el fuente crudo falla
 * por la propia explicación — y el arreglo tentador, borrar la explicación, es
 * exactamente lo que no queremos.
 */
const codeOnly = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const WORKFLOW_CODE = codeOnly(WORKFLOW);
const GET_CLIENT_CODE = codeOnly(GET_CLIENT);
const SERVICE_CODE = codeOnly(SERVICE);

/* -------------------------------------------------------------------------- */
/* Cotización — el provider                                                    */
/* -------------------------------------------------------------------------- */

test('el provider recibe la conexión Postgres por el cradle', () => {
  // Es la ÚNICA vía: un provider de fulfillment recibe un container aislado y no
  // puede resolve() otro módulo. Mismo motivo por el que email y kapso leen
  // store_setting por SQL crudo.
  assert.match(SERVICE, /ContainerRegistrationKeys\.PG_CONNECTION/);
  assert.match(SERVICE, /pgConnection_/);
});

test('la cotización usa el cliente de la tienda, no el del boot', () => {
  // El contrato de Andreani determina la tarifa: cotizar con la cuenta de otra
  // tienda devuelve un precio que después no se puede despachar.
  assert.match(SERVICE, /await client\.getTarifas\(/);
  assert.doesNotMatch(
    SERVICE_CODE,
    /await this\.client_\.getTarifas\(/,
    'la cotización volvió a usar el cliente del boot, ignorando la tienda',
  );
});

test('la cotización usa el CONTRATO de la tienda, no el override de la instancia', () => {
  // Segunda mitad del mismo problema, y la que más se escapaba: el cliente ya salía
  // de la tienda pero `resolveContractForService` leía `process.env` adentro, así que
  // los tres `*_CONTRACT_OVERRIDE` eran inmunes a la configuración por tienda.
  const body = SERVICE.slice(SERVICE.indexOf('async calculatePrice'));
  assert.match(body, /resolveContractForService\(\s*serviceType,\s*options\.contract,\s*contractOverrides,?\s*\)/);
});

test('sin credenciales propias cae al contexto de entorno', () => {
  // Es lo que permite desplegar esto sin migrar ninguna tienda: el comportamiento
  // por defecto es exactamente el de antes.
  const body = SERVICE.slice(SERVICE.indexOf('async contextForChannel'));
  assert.match(body, /if \(!channelId \|\| !this\.pgConnection_\) return fromBoot\(\);/);
  assert.match(body, /creds\.source === 'site'/);
});

test('un blob ILEGIBLE corta el despacho en vez de usar otra cuenta', () => {
  // La decisión que más importa de todo P3. Si la tienda declaró credenciales y no
  // se pueden descifrar (típicamente porque rotó JWT_SECRET), caer al entorno
  // significa despachar y facturar con la cuenta de otro titular. El envío sale
  // igual: por eso vale más fallar.
  for (const [name, source] of [
    ['provider', SERVICE],
    ['get-client', GET_CLIENT],
  ] as const) {
    const body = source.slice(source.indexOf('undecryptable') - 400);
    assert.match(body, /reason === 'undecryptable'/, `${name}: se perdió el corte`);
    assert.match(body, /throw new Error\(/, `${name}: ya no tira`);
    // Y el catch de abajo NO puede tragárselo.
    assert.match(
      body,
      /no se pueden descifrar'\)\) throw error;/,
      `${name}: el catch se come el corte`,
    );
  }
});

test('un fallo de LECTURA sí degrada, con aviso', () => {
  // Distinto del anterior: si la DB no responde, dejar la instancia sin despachar
  // sería peor que usar las credenciales de entorno, que es lo que se venía usando.
  const body = SERVICE.slice(SERVICE.indexOf('async contextForChannel'));
  assert.match(body, /logger_\.warn\(/);
  assert.match(body, /Se usan las de entorno/);
});

test('el constructor NO tira por credenciales incompletas', () => {
  // `medusa-config.ts:455` registra el provider si ANDREANI_USERNAME está seteada,
  // pero el normalize viejo exigía además password y contract y LANZABA. Con la
  // contraseña vacía, el backend entero no arrancaba. Precedente de la degradación:
  // kapso-whatsapp/service.ts:79-93.
  const ctor = SERVICE.slice(SERVICE.indexOf('constructor(cradle'), SERVICE.indexOf('async contextForChannel'));
  assert.doesNotMatch(codeOnly(ctor), /throw new Error\(/, 'el constructor volvió a tirar');
  assert.match(ctor, /hasAndreaniCredentials/);
  assert.match(ctor, /logger_\.warn\(/);
});

test('la normalización de options ya no vive en el provider', () => {
  // Estaba como `private static normalizeOptions`, así que ningún camino fuera del
  // provider podía usarla y el workflow operaba con opciones a medio normalizar.
  assert.doesNotMatch(SERVICE_CODE, /private static normalizeOptions/);
  assert.match(SERVICE, /normalizeAndreaniOptions/);
});

/* -------------------------------------------------------------------------- */
/* Despacho — el workflow                                                      */
/* -------------------------------------------------------------------------- */

test('EL BUG: el alta del envío NO puede construir su cliente desde el entorno', () => {
  // `calculatePrice` resolvía las credenciales por tienda, pero este workflow —el
  // único camino que da de alta el envío real— usaba `getAndreaniClient(logger)` y
  // `loadAndreaniOptionsFromEnv()`. Una tienda cotizaba con su cuenta y despachaba
  // con la de la instancia: el envío salía igual y se le facturaba al titular
  // equivocado, sin un solo error en los logs.
  assert.doesNotMatch(
    WORKFLOW_CODE,
    /getAndreaniClient\(/,
    'el workflow volvió a construir el cliente desde el entorno',
  );
  assert.doesNotMatch(
    WORKFLOW_CODE,
    /loadAndreaniOptionsFromEnv\(/,
    'el workflow volvió a leer las opciones del entorno',
  );
  assert.match(WORKFLOW_CODE, /getAndreaniContextForSite\(/);
});

test('el workflow trae el sales_channel_id: sin eso no hay tienda que resolver', () => {
  const validate = WORKFLOW.slice(
    WORKFLOW.indexOf("'validate-order-for-andreani-tickets'"),
    WORKFLOW.indexOf("'create-andreani-ticket-shipment'"),
  );
  assert.match(validate, /'sales_channel_id',/, 'la query dejó de pedir el canal');
  assert.match(validate, /sales_channel_id: getString\(order, 'sales_channel_id'\)/);
});

test('el workflow corta si la tienda no tiene credenciales completas', () => {
  // Como el provider ya no tira en el constructor, el corte tiene que estar donde
  // se despacha: un envío con credenciales a medias falla en Andreani con un error
  // que no dice nada.
  assert.match(WORKFLOW, /ANDREANI_NOT_CONFIGURED/);
});

test('el workflow loguea de qué cuenta salió el envío, sin filtrar la credencial', () => {
  // Es lo único que permite diagnosticar "esta tienda despachó con la cuenta
  // equivocada" mirando los logs.
  assert.match(WORKFLOW, /cuenta: \$\{credentialSource\}/);
});

/* -------------------------------------------------------------------------- */
/* Cache de clientes                                                           */
/* -------------------------------------------------------------------------- */

test('los clientes se cachean por HUELLA y no por tiempo', () => {
  // `AndreaniClient` cachea un token de 23 h (`client.ts:44-46`) y Andreani tiene
  // rate limit propio (`AndreaniRateLimitError`). Un cliente nuevo por cotización es
  // un `GET /login` por cotización.
  assert.match(GET_CLIENT, /credentialsFingerprint/);
  assert.match(GET_CLIENT, /CLIENT_CACHE_MAX/);
  assert.doesNotMatch(
    GET_CLIENT_CODE,
    /new AndreaniClient\(loadAndreaniOptionsFromEnv\(\)/,
    'volvió el cliente sin cache por cada llamada',
  );
});

test('el lector del provider y el de get-client nombran la MISMA integración', () => {
  // `service.ts` usa el literal porque `catalog.test.ts` lo grepea; `get-client.ts`
  // usa la constante. Esta es la costura donde los dos pueden divergir sin que nada
  // lo note, y el modo de falla es el peor de todos: la credencial se guarda en una
  // fila que nadie lee y la tienda sigue despachando con la cuenta del entorno.
  const constante = /ANDREANI_CREDENTIAL_INTEGRATION = '([^']+)'/.exec(GET_CLIENT)?.[1];
  const literal = /readSiteCredentialsViaSql<[^>]+>\(\s*this\.pgConnection_,\s*'([^']+)'/.exec(
    SERVICE_CODE,
  )?.[1];

  assert.equal(constante, 'andreani');
  assert.equal(literal, constante, 'el provider y get-client leen integraciones distintas');
  assert.match(
    GET_CLIENT_CODE,
    /ANDREANI_CREDENTIAL_INTEGRATION,/,
    'get-client dejó de usar la constante: ahora hay dos literales sueltos',
  );
});
