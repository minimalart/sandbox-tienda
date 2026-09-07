import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CORREO_DEFAULT_MICORREO_BASE_PATH,
  CORREO_DEFAULT_PAQAR_BASE_PATH,
  CORREO_PROD_HOSTNAME,
  CORREO_TEST_HOSTNAME,
  normalizeApiKey,
  normalizeBasePath,
  normalizeCorreoOptions,
  normalizeExtClient,
  normalizeHostname,
  normalizeServiceType,
} from './env-options.ts';

/** JWT real de forma, no de contenido. */
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyMDE2OCJ9.abc123';

const minimal = { apiKey: JWT, agreement: '20168' };

describe('normalizeApiKey', () => {
  // La planilla de credenciales de Correo trae la celda como
  // "Apikey eyJhbGci…" y el cliente ya agrega el prefijo por su cuenta.
  it('strippea el prefijo "Apikey " que viene en la planilla', () => {
    assert.equal(normalizeApiKey(`Apikey ${JWT}`), JWT);
  });

  it('es case-insensitive y tolera espacios de más', () => {
    assert.equal(normalizeApiKey(`APIKEY   ${JWT}`), JWT);
    assert.equal(normalizeApiKey(`apikey ${JWT}`), JWT);
  });

  it('no toca una key que ya viene limpia', () => {
    assert.equal(normalizeApiKey(JWT), JWT);
  });

  it('no se come un prefijo que sea parte de la key', () => {
    // Sin espacio no es un prefijo, es el principio del valor.
    assert.equal(normalizeApiKey('ApikeyNoEsPrefijo'), 'ApikeyNoEsPrefijo');
  });

  it('vacío o solo-prefijo → undefined, para que la validación lo agarre', () => {
    assert.equal(normalizeApiKey(undefined), undefined);
    assert.equal(normalizeApiKey('   '), undefined);
    assert.equal(normalizeApiKey('Apikey '), undefined);
  });
});

/**
 * Antes esto se llamaba "el gate de arranque" y `normalizeCorreoOptions` TIRABA
 * sin `apiKey` o sin `agreement`.
 *
 * Ya no, y el cambio es deliberado: con `app-settings` la configuración se resuelve
 * POR TIENDA y POR LLAMADA, así que una tienda secundaria que todavía no cargó su
 * acuerdo resuelve a `'off'` por fail-closed — un estado ESPERADO que el throw
 * convertía en una excepción en medio de una cotización. El provider se registra
 * siempre y degrada, que es el patrón de `kapso-whatsapp/service.ts:79-93`.
 *
 * Lo que sí tiene que seguir siendo cierto, y es lo que se pinea acá: la ausencia
 * se representa como `''`, NUNCA como `undefined` ni con un valor inventado. Es lo
 * que hace que `canQuoteWith()` y el log de arranque puedan detectarla.
 */
describe('normalizeCorreoOptions — ausencia de credenciales', () => {
  it('sin apiKey NO tira: degrada con la credencial vacía', () => {
    assert.equal(normalizeCorreoOptions({ agreement: '20168' }).apiKey, '');
    assert.equal(normalizeCorreoOptions({}).apiKey, '');
    assert.equal(normalizeCorreoOptions(undefined).apiKey, '');
  });

  it('sin agreement NO tira: degrada con el acuerdo vacío', () => {
    assert.equal(normalizeCorreoOptions({ apiKey: JWT }).agreement, '');
  });

  it('una apiKey que era SOLO el prefijo cuenta como ausente', () => {
    assert.equal(
      normalizeCorreoOptions({ apiKey: 'Apikey ', agreement: '20168' }).apiKey,
      '',
    );
  });

  it('sin agreement el sellerId también queda vacío, no "undefined"', () => {
    // `sellerId` cae al `agreement`. Si el agreement fuera `undefined`, el string
    // "undefined" terminaría viajando en el payload de `POST /orders`.
    assert.equal(normalizeCorreoOptions({ apiKey: JWT }).sellerId, '');
  });

  it('las credenciales de MiCorreo NO son fatales: sin cotización se puede operar', () => {
    const options = normalizeCorreoOptions(minimal);
    assert.deepEqual(options.micorreo, {
      username: '',
      password: '',
      customerId: '',
    });
  });

  it('sellerId cae al agreement cuando no se configura', () => {
    assert.equal(normalizeCorreoOptions(minimal).sellerId, '20168');
    assert.equal(
      normalizeCorreoOptions({ ...minimal, sellerId: '999' }).sellerId,
      '999',
    );
  });
});

describe('normalizeCorreoOptions — hostname', () => {
  it('sin testMode apunta a producción', () => {
    assert.equal(normalizeCorreoOptions(minimal).hostname, CORREO_PROD_HOSTNAME);
  });

  it('testMode acepta el boolean y el string "true" (las env vars son strings)', () => {
    for (const testMode of [true, 'true', 'TRUE']) {
      assert.equal(
        normalizeCorreoOptions({ ...minimal, testMode }).hostname,
        CORREO_TEST_HOSTNAME,
        `testMode=${String(testMode)}`,
      );
    }
  });

  it('un hostname explícito gana sobre testMode', () => {
    assert.equal(
      normalizeCorreoOptions({ ...minimal, testMode: true, hostname: 'x.dev' })
        .hostname,
      'x.dev',
    );
  });
});

describe('normalizeHostname', () => {
  // El valor se interpola como `https://${hostname}${basePath}`: un `https://`
  // pegado del navegador daría `https://https://api…`.
  it('saca el esquema pegado', () => {
    assert.equal(
      normalizeHostname('https://api.correoargentino.com.ar'),
      'api.correoargentino.com.ar',
    );
    assert.equal(
      normalizeHostname('http://api.correoargentino.com.ar'),
      'api.correoargentino.com.ar',
    );
  });

  it('saca el path o el slash final pegado atrás', () => {
    assert.equal(
      normalizeHostname('api.correoargentino.com.ar/'),
      'api.correoargentino.com.ar',
    );
    assert.equal(
      normalizeHostname('https://api.correoargentino.com.ar/paqar/v1'),
      'api.correoargentino.com.ar',
    );
  });

  it('trimea y normaliza a minúsculas', () => {
    assert.equal(
      normalizeHostname('  API.CorreoArgentino.com.ar  '),
      'api.correoargentino.com.ar',
    );
  });

  it('no toca un hostname que ya viene limpio', () => {
    assert.equal(
      normalizeHostname('apitest.correoargentino.com.ar'),
      'apitest.correoargentino.com.ar',
    );
    // Un host con puerto sigue siendo interpolable tal cual.
    assert.equal(normalizeHostname('proxy.interno:8443'), 'proxy.interno:8443');
  });

  it('lo que no deja nada utilizable es undefined, para caer al fallback', () => {
    for (const value of [undefined, '', '   ', 'https://', '/']) {
      assert.equal(normalizeHostname(value), undefined, String(value));
    }
  });
});

describe('normalizeBasePath', () => {
  const FALLBACK = '/paqar/v1';

  it('agrega el slash inicial que falta', () => {
    assert.equal(normalizeBasePath('paqar/v1', FALLBACK), '/paqar/v1');
    assert.equal(normalizeBasePath('paqar/v2', FALLBACK), '/paqar/v2');
  });

  // Los clientes concatenan `baseURL + '/orders'`: el doble slash resultante
  // puede dar 404 o 403 en un gateway.
  it('saca el slash final que sobra', () => {
    assert.equal(normalizeBasePath('/paqar/v1/', FALLBACK), '/paqar/v1');
    assert.equal(normalizeBasePath('/paqar/v1///', FALLBACK), '/paqar/v1');
  });

  it('colapsa los slashes iniciales de más', () => {
    assert.equal(normalizeBasePath('//paqar/v1', FALLBACK), '/paqar/v1');
  });

  it('trimea', () => {
    assert.equal(normalizeBasePath('  /paqar/v1  ', FALLBACK), '/paqar/v1');
  });

  it('lo que queda vacío cae al default en vez de armar una URL rota', () => {
    for (const value of [undefined, '', '   ', '/', '///']) {
      assert.equal(normalizeBasePath(value, FALLBACK), FALLBACK, String(value));
    }
  });

  it('no toca un path que ya viene bien', () => {
    assert.equal(normalizeBasePath('/micorreo/v1', FALLBACK), '/micorreo/v1');
  });
});

describe('normalizeCorreoOptions — endpoints de las dos APIs', () => {
  /**
   * Test de REGRESIÓN: exponer host y base path por env NO cambia a dónde apunta
   * una instalación que no setea nada. Estas dos URLs son exactamente las que el
   * módulo armaba con los paths hardcodeados.
   */
  it('sin nada seteado, las baseURL son las de siempre', () => {
    const { api } = normalizeCorreoOptions(minimal);

    assert.equal(api.paqar.baseUrl, 'https://api.correoargentino.com.ar/paqar/v1');
    assert.equal(
      api.micorreo.baseUrl,
      'https://api.correoargentino.com.ar/micorreo/v1',
    );
    assert.equal(api.paqar.basePath, CORREO_DEFAULT_PAQAR_BASE_PATH);
    assert.equal(api.micorreo.basePath, CORREO_DEFAULT_MICORREO_BASE_PATH);
  });

  it('en testMode las dos apuntan al host de test', () => {
    const { api } = normalizeCorreoOptions({ ...minimal, testMode: 'true' });

    assert.equal(
      api.paqar.baseUrl,
      `https://${CORREO_TEST_HOSTNAME}/paqar/v1`,
    );
    assert.equal(
      api.micorreo.baseUrl,
      `https://${CORREO_TEST_HOSTNAME}/micorreo/v1`,
    );
  });

  it('los base paths se pueden overridear por separado', () => {
    const { api } = normalizeCorreoOptions({
      ...minimal,
      paqarBasePath: 'paqar/v2/',
      micorreoBasePath: '/micorreo/v3',
    });

    assert.equal(api.paqar.baseUrl, 'https://api.correoargentino.com.ar/paqar/v2');
    assert.equal(
      api.micorreo.baseUrl,
      'https://api.correoargentino.com.ar/micorreo/v3',
    );
  });

  it('un base path basura cae al default y no rompe la URL', () => {
    const { api } = normalizeCorreoOptions({
      ...minimal,
      paqarBasePath: '   ',
      micorreoBasePath: '/',
    });

    assert.equal(api.paqar.baseUrl, 'https://api.correoargentino.com.ar/paqar/v1');
    assert.equal(
      api.micorreo.baseUrl,
      'https://api.correoargentino.com.ar/micorreo/v1',
    );
  });

  it('el hostname con el esquema pegado no produce https://https://', () => {
    const { hostname, api } = normalizeCorreoOptions({
      ...minimal,
      hostname: 'https://proxy.interno.example/',
    });

    assert.equal(hostname, 'proxy.interno.example');
    assert.equal(api.paqar.baseUrl, 'https://proxy.interno.example/paqar/v1');
    assert.equal(
      api.micorreo.baseUrl,
      'https://proxy.interno.example/micorreo/v1',
    );
  });
});

/**
 * La cadena tiene TRES niveles y el orden importa: sin la variable propia, el
 * comportamiento tiene que ser el de antes (un solo host para las dos APIs).
 *
 * El caso que motiva el override: hay reportes de integradores de que el sandbox
 * de MiCorreo no responde, así que "operar en test y cotizar en prod" puede ser la
 * única combinación viable.
 */
describe('normalizeCorreoOptions — fallback del hostname de MiCorreo', () => {
  it('nivel 1: la variable propia gana', () => {
    const { hostname, api } = normalizeCorreoOptions({
      ...minimal,
      testMode: true,
      hostname: 'paqar.interno.example',
      micorreoHostname: 'https://api.correoargentino.com.ar',
    });

    assert.equal(hostname, 'paqar.interno.example');
    assert.equal(api.paqar.hostname, 'paqar.interno.example');
    assert.equal(api.micorreo.hostname, CORREO_PROD_HOSTNAME);
    assert.equal(
      api.micorreo.baseUrl,
      `https://${CORREO_PROD_HOSTNAME}/micorreo/v1`,
    );
  });

  it('nivel 2: sin la propia, usa el HOSTNAME general', () => {
    const { api } = normalizeCorreoOptions({
      ...minimal,
      hostname: 'proxy.interno.example',
    });

    assert.equal(api.micorreo.hostname, 'proxy.interno.example');
    assert.equal(api.micorreo.hostname, api.paqar.hostname);
  });

  it('nivel 3: sin ninguna de las dos, el derivado de testMode', () => {
    assert.equal(
      normalizeCorreoOptions({ ...minimal, testMode: true }).api.micorreo
        .hostname,
      CORREO_TEST_HOSTNAME,
    );
    assert.equal(
      normalizeCorreoOptions(minimal).api.micorreo.hostname,
      CORREO_PROD_HOSTNAME,
    );
  });

  it('una propia vacía o basura no desengancha el fallback', () => {
    for (const micorreoHostname of ['', '   ', 'https://']) {
      assert.equal(
        normalizeCorreoOptions({ ...minimal, micorreoHostname, testMode: true })
          .api.micorreo.hostname,
        CORREO_TEST_HOSTNAME,
        JSON.stringify(micorreoHostname),
      );
    }
  });
});

describe('normalizeExtClient', () => {
  // Mandarlo mal es PEOR que omitirlo: omitido, Correo appendea 000 al agreement.
  it('acepta exactamente 3 dígitos', () => {
    assert.equal(normalizeExtClient('007'), '007');
    assert.equal(normalizeExtClient(' 123 '), '123');
  });

  it('descarta cualquier otra cosa', () => {
    for (const value of ['7', '1234', 'abc', '12a', '', undefined]) {
      assert.equal(normalizeExtClient(value), undefined, String(value));
    }
  });
});

describe('normalizeServiceType', () => {
  it('solo CP y EP; cualquier otra cosa cae a CP', () => {
    assert.equal(normalizeServiceType('EP'), 'EP');
    assert.equal(normalizeServiceType('ep'), 'EP');
    assert.equal(normalizeServiceType('CP'), 'CP');
    assert.equal(normalizeServiceType('Paq.ar Hoy'), 'CP');
    assert.equal(normalizeServiceType(undefined), 'CP');
  });
});
