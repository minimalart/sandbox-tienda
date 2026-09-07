/**
 * Estos tests pinean la forma de los query params que el módulo DECIDIÓ mandar a
 * paqar/v1. En los dos casos (`stateId` de una letra y los TNs como query param)
 * la decisión es una **INFERENCIA nuestra que contradice al manual y está SIN
 * VERIFICAR contra la API real** — no hay credenciales todavía.
 *
 * Son tests de regresión sobre una decisión, no sobre un comportamiento
 * observado: si alguien cambia la forma sin querer, rompen. Si la QA demuestra
 * que el manual tiene razón, se dan vuelta a propósito junto con
 * `buildTrackingParams()` / `buildAgencyParams()`, que son los únicos lugares
 * donde se cambia.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import axios, { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import PaqarClient, {
  buildAgencyParams,
  buildTrackingParams,
  PAQAR_AUTH_OK_STATUSES,
} from './paqar-client.ts';
import { normalizeCorreoOptions } from '../env-options.ts';
import { CorreoAPIError, CorreoValidationError } from '../utils/errors.ts';

describe('buildTrackingParams', () => {
  // ⚠️ INFERENCIA (sin verificar): el manual documenta los TNs como CUERPO de un
  // GET; asumimos que el gateway descarta el body y los mandamos como query
  // param, en plural. Pendiente de verificar en QA contra `apitest`.
  it('manda los TNs en el query param `trackingNumbers` (plural)', () => {
    const params = buildTrackingParams(['AA1', 'AA2']);
    assert.deepEqual(params, { trackingNumbers: ['AA1', 'AA2'] });
  });

  it('trimea y descarta los vacíos', () => {
    const params = buildTrackingParams([' AA1 ', '', null, undefined, 'AA2']);
    assert.deepEqual(params.trackingNumbers, ['AA1', 'AA2']);
  });

  it('agrega extClient solo cuando está configurado', () => {
    assert.equal(buildTrackingParams(['AA1']).extClient, undefined);
    assert.equal(buildTrackingParams(['AA1'], '007').extClient, '007');
  });

  it('sin TNs útiles falla antes de salir a la red', () => {
    assert.throws(() => buildTrackingParams([]), CorreoValidationError);
    assert.throws(() => buildTrackingParams(['   ']), CorreoValidationError);
  });
});

describe('buildAgencyParams', () => {
  // ⚠️ INFERENCIA (sin verificar): el manual dice ISO 3166-2; asumimos que
  // `/agencies` quiere la misma letra que `POST /orders` y que el ISO sería
  // rechazado por tamaño. Pendiente de verificar en QA.
  it('convierte el ISO 3166-2 al código de UNA letra', () => {
    assert.equal(buildAgencyParams({ stateId: 'AR-C' }).stateId, 'C');
    assert.equal(buildAgencyParams({ stateId: 'ar-b' }).stateId, 'B');
  });

  it('acepta el nombre de la provincia y sus variantes', () => {
    assert.equal(buildAgencyParams({ stateId: 'CABA' }).stateId, 'C');
    assert.equal(buildAgencyParams({ stateId: 'Buenos Aires' }).stateId, 'B');
    assert.equal(buildAgencyParams({ stateId: 'Córdoba' }).stateId, 'X');
  });

  it('deja pasar el código de una letra tal cual', () => {
    assert.equal(buildAgencyParams({ stateId: 'C' }).stateId, 'C');
    assert.equal(buildAgencyParams({ stateId: 'b' }).stateId, 'B');
  });

  it('una provincia irreconocible falla acá y no con un 500 opaco', () => {
    assert.throws(
      () => buildAgencyParams({ stateId: 'Narnia' }),
      CorreoValidationError,
    );
  });

  it('sin filtros no manda params (padrón completo)', () => {
    assert.deepEqual(buildAgencyParams(), {});
    assert.deepEqual(buildAgencyParams({}), {});
  });

  it('los booleanos van con snake_case y solo si son boolean explícito', () => {
    assert.deepEqual(
      buildAgencyParams({ pickupAvailability: true, packageReception: false }),
      { pickup_availability: true, package_reception: false },
    );
    assert.deepEqual(buildAgencyParams({ pickupAvailability: undefined }), {});
  });
});

/**
 * Sonda de `GET /auth`.
 *
 * Se corren con un **adapter de axios propio** en vez de una librería de mocks:
 * el cliente crea su propia instancia y `axios.create()` toma el adapter de
 * `axios.defaults` EN EL MOMENTO de crearse, así que alcanza con pinearlo antes
 * de construir el cliente. Cero dependencias nuevas, cero red, y no hace falta
 * meter mano en el `axiosInstance` privado.
 *
 * Lo que se verifica es lo único que la ruta de health necesita del cliente: que
 * el MOTIVO de la falla sobreviva. Nada de esto se ejercitó contra la API real de
 * Correo — no hay credenciales.
 */
describe('PaqarClient.probeAuth — el motivo de la falla sobrevive', () => {
  const options = normalizeCorreoOptions({ apiKey: 'k', agreement: 'a' });
  const logger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  };

  /** Construye el cliente con un adapter pineado y lo devuelve. */
  const withAdapter = async <T>(
    adapter: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>,
    action: (client: PaqarClient) => Promise<T>,
  ): Promise<T> => {
    const original = axios.defaults.adapter;
    axios.defaults.adapter = adapter;
    try {
      return await action(new PaqarClient(options, logger));
    } finally {
      axios.defaults.adapter = original;
    }
  };

  const ok = (status: number) =>
    async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
      data: '',
      status,
      statusText: '',
      headers: {},
      config,
    });

  const failsWith = (status: number, data: unknown) =>
    async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      throw new AxiosError(
        `Request failed with status code ${status}`,
        'ERR_BAD_REQUEST',
        config,
        undefined,
        { data, status, statusText: '', headers: {}, config },
      );
    };

  const timesOut = async (
    config: InternalAxiosRequestConfig,
  ): Promise<AxiosResponse> => {
    throw new AxiosError(
      'timeout of 12000ms exceeded',
      'ECONNABORTED',
      config,
      {},
    );
  };

  it('devuelve el status crudo cuando la llamada sale bien', async () => {
    for (const status of PAQAR_AUTH_OK_STATUSES) {
      assert.equal(
        await withAdapter(ok(status), (client) => client.probeAuth()),
        status,
      );
    }
  });

  it('pega a /auth con la API-Key y el agreement en headers', async () => {
    let seen: InternalAxiosRequestConfig | undefined;
    await withAdapter(
      async (config) => {
        seen = config;
        return {
          data: '',
          status: 204,
          statusText: '',
          headers: {},
          config,
        };
      },
      (client) => client.probeAuth(),
    );

    assert.equal(seen?.url, '/auth');
    assert.equal(seen?.method, 'get');
    assert.equal(seen?.headers.authorization, 'Apikey k');
    assert.equal(seen?.headers.agreement, 'a');
  });

  // El motivo de existir de `probeAuth()`: con el booleano de `testConnection()`
  // estos dos casos son indistinguibles, y son las dos únicas conclusiones
  // accionables para el operador.
  it('un 401 conserva el statusCode', async () => {
    await assert.rejects(
      withAdapter(failsWith(401, { error: 'Unauthorized', message: '' }), (client) =>
        client.probeAuth(),
      ),
      (error: unknown) => {
        assert.ok(error instanceof CorreoAPIError);
        assert.equal(error.statusCode, 401);
        assert.match(error.message, /Unauthorized/);
        return true;
      },
    );
  });

  it('un timeout deja el statusCode en undefined (la señal de "no hubo respuesta")', async () => {
    await assert.rejects(
      withAdapter(timesOut, (client) => client.probeAuth()),
      (error: unknown) => {
        assert.ok(error instanceof CorreoAPIError);
        assert.equal(error.statusCode, undefined);
        return true;
      },
    );
  });

  it('testConnection sigue siendo un booleano y no tira', async () => {
    assert.equal(
      await withAdapter(ok(204), (client) => client.testConnection()),
      true,
    );
    assert.equal(
      await withAdapter(ok(418), (client) => client.testConnection()),
      false,
    );
    assert.equal(
      await withAdapter(failsWith(403, 'Forbidden'), (client) =>
        client.testConnection(),
      ),
      false,
    );
    assert.equal(
      await withAdapter(timesOut, (client) => client.testConnection()),
      false,
    );
  });
});

/**
 * A qué URL sale realmente el cliente.
 *
 * El host y el base path de paqar son configurables por env
 * (`CORREO_ARGENTINO_HOSTNAME`, `CORREO_ARGENTINO_PAQAR_BASE_PATH`) y el cliente ya
 * NO concatena nada: consume la `baseUrl` que resolvió `normalizeCorreoOptions()`.
 * El primer test es de REGRESIÓN: sin nada seteado, la URL es la misma que con los
 * paths hardcodeados.
 *
 * Se lee del `config` del adapter y no del `axiosInstance` privado: es la URL que
 * axios habría pedido de verdad. Nada de esto salió a la red.
 */
describe('PaqarClient — la baseURL que resuelve', () => {
  const logger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  };

  /** Construye el cliente con las options dadas y devuelve la URL pedida. */
  const requestedUrl = async (
    rawOptions: Record<string, unknown>,
  ): Promise<string> => {
    let seen = '';
    const original = axios.defaults.adapter;
    axios.defaults.adapter = async (
      config: InternalAxiosRequestConfig,
    ): Promise<AxiosResponse> => {
      seen = `${config.baseURL ?? ''}${config.url ?? ''}`;
      return {
        data: '',
        status: 200,
        statusText: '',
        headers: {},
        config,
      };
    };
    try {
      const client = new PaqarClient(
        normalizeCorreoOptions({ apiKey: 'k', agreement: 'a', ...rawOptions }),
        logger,
      );
      await client.probeAuth();
    } finally {
      axios.defaults.adapter = original;
    }
    return seen;
  };

  it('sin overrides es la de siempre: https://api…/paqar/v1', async () => {
    assert.equal(
      await requestedUrl({}),
      'https://api.correoargentino.com.ar/paqar/v1/auth',
    );
  });

  it('testMode apunta a apitest, mismo path', async () => {
    assert.equal(
      await requestedUrl({ testMode: 'true' }),
      'https://apitest.correoargentino.com.ar/paqar/v1/auth',
    );
  });

  it('el override de base path viaja hasta la request, normalizado', async () => {
    assert.equal(
      await requestedUrl({ paqarBasePath: 'paqar/v2/' }),
      'https://api.correoargentino.com.ar/paqar/v2/auth',
    );
  });

  it('un hostname con el esquema pegado no arma https://https://', async () => {
    assert.equal(
      await requestedUrl({ hostname: 'https://proxy.interno.example/' }),
      'https://proxy.interno.example/paqar/v1/auth',
    );
  });

  it('el hostname de MiCorreo NO afecta a paqar', async () => {
    assert.equal(
      await requestedUrl({ micorreoHostname: 'otro.host.example' }),
      'https://api.correoargentino.com.ar/paqar/v1/auth',
    );
  });
});
