import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import axios, { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import MiCorreoClient, {
  MICORREO_TOKEN_FALLBACK_TTL_MS,
  MICORREO_TOKEN_MAX_TTL_MS,
  MICORREO_TOKEN_SAFETY_RATIO,
  parseRatesResponse,
  resolveTokenTtlMs,
  selectRate,
} from './micorreo-client.ts';
import { normalizeCorreoOptions } from '../env-options.ts';
import { CorreoAPIError, CorreoAuthError } from '../utils/errors.ts';
import type { CorreoRate } from '../types.ts';

const rate = (overrides: Partial<CorreoRate> = {}): CorreoRate => ({
  deliveredType: 'D',
  productType: 'CP',
  productName: 'Correo Argentino Clasico',
  price: 5400,
  deliveryTimeMin: '2',
  deliveryTimeMax: '5',
  ...overrides,
});

describe('parseRatesResponse — outcome ok', () => {
  it('devuelve las tarifas y los metadatos', () => {
    const result = parseRatesResponse(
      {
        customerId: '0000550137',
        validTo: '2026-04-01',
        rates: [rate(), rate({ deliveredType: 'S', price: 4200 })],
      },
      200,
    );

    assert.equal(result.outcome, 'ok');
    assert.equal(result.rates.length, 2);
    assert.equal(result.customerId, '0000550137');
    assert.equal(result.validTo, '2026-04-01');
    assert.equal(result.httpStatus, 200);
  });

  it('202 con tarifas igual es ok (la cuenta responde)', () => {
    const result = parseRatesResponse({ rates: [rate()] }, 202);
    assert.equal(result.outcome, 'ok');
  });
});

describe('parseRatesResponse — cuenta no activada vs error real', () => {
  // ⚠️ Una cuenta que Correo no activó comercialmente devuelve 202 con
  // rates: []. NO es un bug de código y hay que distinguirlo o se pierde un día
  // debuggeando el request.
  it('202 con rates vacío → account_not_activated', () => {
    const result = parseRatesResponse({ customerId: '1', rates: [] }, 202);
    assert.equal(result.outcome, 'account_not_activated');
    assert.deepEqual(result.rates, []);
    assert.equal(result.httpStatus, 202);
  });

  it('200 con rates vacío → no_rates (la ruta no tiene servicio, no es falta de activación)', () => {
    const result = parseRatesResponse({ rates: [] }, 200);
    assert.equal(result.outcome, 'no_rates');
  });

  it('los dos casos vacíos son distinguibles entre sí', () => {
    assert.notEqual(
      parseRatesResponse({ rates: [] }, 202).outcome,
      parseRatesResponse({ rates: [] }, 200).outcome,
    );
  });

  it('un body sin rates / basura no rompe: degrada a no_rates', () => {
    for (const body of [{}, null, undefined, 'nope', { rates: 'nope' }]) {
      const result = parseRatesResponse(body, 200);
      assert.equal(result.outcome, 'no_rates');
      assert.deepEqual(result.rates, []);
    }
  });

  it('descarta entradas no-objeto dentro de rates', () => {
    const result = parseRatesResponse({ rates: [rate(), null, 'x'] }, 200);
    assert.equal(result.rates.length, 1);
  });
});

describe('selectRate — match por productType', () => {
  const rates = [
    rate({ productType: 'CP', deliveredType: 'D', price: 5400 }),
    rate({ productType: 'CP', deliveredType: 'S', price: 4200 }),
    rate({ productType: 'EP', deliveredType: 'D', price: 8900 }),
  ];

  it('matchea por productType y deliveredType', () => {
    assert.equal(
      selectRate(rates, { serviceType: 'CP', deliveredType: 'D' })?.price,
      5400,
    );
    assert.equal(
      selectRate(rates, { serviceType: 'CP', deliveredType: 'S' })?.price,
      4200,
    );
    assert.equal(
      selectRate(rates, { serviceType: 'EP', deliveredType: 'D' })?.price,
      8900,
    );
  });

  it('sin deliveredType toma la primera del producto', () => {
    assert.equal(selectRate(rates, { serviceType: 'CP' })?.price, 5400);
  });

  it('el match de productType es case-insensitive', () => {
    assert.equal(
      selectRate([rate({ productType: 'cp' })], { serviceType: 'CP' })?.price,
      5400,
    );
  });

  it('si el producto pedido no tiene la modalidad, cae a la del producto', () => {
    const onlyHome = [rate({ productType: 'EP', deliveredType: 'D', price: 8900 })];
    assert.equal(
      selectRate(onlyHome, { serviceType: 'EP', deliveredType: 'S' })?.price,
      8900,
    );
  });

  it('si el producto no está, cae a cualquier tarifa de la modalidad', () => {
    const onlyClassic = [rate({ productType: 'CP', deliveredType: 'S', price: 4200 })];
    assert.equal(
      selectRate(onlyClassic, { serviceType: 'EP', deliveredType: 'S' })?.price,
      4200,
    );
  });

  it('lista vacía → undefined (el caller degrada)', () => {
    assert.equal(selectRate([], { serviceType: 'CP' }), undefined);
  });
});

describe('resolveTokenTtlMs — el expires no trae timezone', () => {
  const now = Date.parse('2026-04-26T20:00:00.000Z');

  it('aplica el ratio de seguridad sobre el TTL aparente', () => {
    // "2026-04-26 20:30:00" leído como UTC → 30 min aparentes.
    const ttl = resolveTokenTtlMs('2026-04-26 20:30:00', now);
    assert.equal(ttl, Math.floor(30 * 60 * 1000 * MICORREO_TOKEN_SAFETY_RATIO));
  });

  it('nunca confía en un expires larguísimo: techo de 1h', () => {
    assert.equal(
      resolveTokenTtlMs('2027-04-26 20:00:00', now),
      MICORREO_TOKEN_MAX_TTL_MS,
    );
  });

  it('un expires ya vencido bajo la asunción UTC puede ser un artefacto de timezone → fallback', () => {
    assert.equal(
      resolveTokenTtlMs('2026-04-26 19:00:00', now),
      MICORREO_TOKEN_FALLBACK_TTL_MS,
    );
  });

  it('expires ausente, vacío o ilegible → fallback conservador', () => {
    for (const value of [undefined, null, '', '   ', 'nope', 42, {}]) {
      assert.equal(
        resolveTokenTtlMs(value, now),
        MICORREO_TOKEN_FALLBACK_TTL_MS,
        `${String(value)} debería caer al fallback`,
      );
    }
  });

  it('si el expires SÍ trae offset, se respeta', () => {
    const ttl = resolveTokenTtlMs('2026-04-26T18:30:00-03:00', now);
    // 21:30 UTC → 90 min aparentes → recortado por el techo de 1h.
    assert.equal(ttl, MICORREO_TOKEN_MAX_TTL_MS);
  });

  it('interpretar como UTC es la lectura más conservadora', () => {
    // El mismo string leído como ART (UTC-3) daría 3h más de vida. Al asumir
    // UTC el token se renueva antes, nunca después.
    const asUtc = resolveTokenTtlMs('2026-04-26 20:30:00', now);
    const asArt = resolveTokenTtlMs('2026-04-26T20:30:00-03:00', now);
    assert.ok(asUtc < asArt);
  });
});

/**
 * Sonda de MiCorreo: `POST /token` y después `POST /rates`.
 *
 * Mismo truco que en `paqar-client.test.ts`: un **adapter de axios propio**
 * pineado en `axios.defaults` ANTES de construir el cliente (que es cuando
 * `axios.create()` lo toma). Sin dependencias nuevas y sin red.
 *
 * ⚠️ Nada de esto se ejercitó contra la API real de Correo: no hay credenciales.
 * Es la conducta que decidimos que tengan `probeAuth()` y `getRates()`.
 */
describe('MiCorreoClient.probeAuth — el status del /token sobrevive', () => {
  const options = normalizeCorreoOptions({
    apiKey: 'k',
    agreement: 'a',
    micorreo: { username: 'u', password: 'p', customerId: 'c' },
    origin: { postalCode: '1000' },
  });
  const logger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  };

  const withAdapter = async <T>(
    adapter: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>,
    action: (client: MiCorreoClient) => Promise<T>,
  ): Promise<T> => {
    const original = axios.defaults.adapter;
    axios.defaults.adapter = adapter;
    try {
      return await action(new MiCorreoClient(options, logger));
    } finally {
      axios.defaults.adapter = original;
    }
  };

  const respond = (
    config: InternalAxiosRequestConfig,
    status: number,
    data: unknown,
  ): AxiosResponse => ({
    data,
    status,
    statusText: '',
    headers: {},
    config,
  });

  const rejectWith = (
    config: InternalAxiosRequestConfig,
    status: number,
    data: unknown,
  ): never => {
    throw new AxiosError(
      `Request failed with status code ${status}`,
      'ERR_BAD_REQUEST',
      config,
      undefined,
      respond(config, status, data),
    );
  };

  /** Token OK; `/rates` responde lo que se le indique. */
  const gateway =
    (rates: { status: number; body: unknown }) =>
    async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      if (config.url?.includes('/token')) {
        return respond(config, 200, {
          token: 'jwt-de-prueba',
          expires: '2099-01-01 00:00:00',
        });
      }
      return respond(config, rates.status, rates.body);
    };

  it('un 401 del /token conserva el statusCode (CorreoAuthError lo perdía)', async () => {
    await assert.rejects(
      withAdapter(
        async (config) => rejectWith(config, 401, { error: 'Unauthorized' }),
        (client) => client.probeAuth(),
      ),
      (error: unknown) => {
        assert.ok(error instanceof CorreoAPIError);
        assert.equal(error.statusCode, 401);
        return true;
      },
    );
  });

  it('un timeout del /token deja el statusCode en undefined', async () => {
    await assert.rejects(
      withAdapter(
        async (config) => {
          throw new AxiosError(
            'timeout of 12000ms exceeded',
            'ECONNABORTED',
            config,
            {},
          );
        },
        (client) => client.probeAuth(),
      ),
      (error: unknown) => {
        assert.ok(error instanceof CorreoAPIError);
        assert.equal(error.statusCode, undefined);
        return true;
      },
    );
  });

  it('authenticate() mantiene su contrato: CorreoAuthError con el motivo adentro', async () => {
    await assert.rejects(
      withAdapter(
        async (config) => rejectWith(config, 401, { error: 'Unauthorized' }),
        (client) => client.authenticate(),
      ),
      (error: unknown) => {
        assert.ok(
          error instanceof CorreoAuthError,
          'los callers de cotización esperan CorreoAuthError',
        );
        assert.match(error.message, /Failed to authenticate with the MiCorreo API/);
        return true;
      },
    );
  });

  it('sin credenciales no sale a la red, en los dos caminos', async () => {
    const sinCreds = normalizeCorreoOptions({ apiKey: 'k', agreement: 'a' });
    const original = axios.defaults.adapter;
    axios.defaults.adapter = async () => {
      throw new Error('la sonda NO tendría que haber salido a la red');
    };
    try {
      const client = new MiCorreoClient(sinCreds, logger);
      await assert.rejects(client.probeAuth(), CorreoAuthError);
      await assert.rejects(client.authenticate(), CorreoAuthError);
    } finally {
      axios.defaults.adapter = original;
    }
  });

  // ⚠️ EL CASO QUE JUSTIFICA EL PASO 2. Una cuenta que Correo no activó
  // comercialmente AUTENTICA PERFECTO: si la sonda se quedara en `/token`,
  // diría "todo bien" mientras el checkout cotiza $0 y muestra "Gratuito".
  it('token OK + /rates 202 vacío = autentica pero la cuenta no está activada', async () => {
    const result = await withAdapter(
      gateway({ status: 202, body: { customerId: 'c', rates: [] } }),
      async (client) => {
        await client.probeAuth();
        return client.getRates({
          postalCodeOrigin: '1000',
          postalCodeDestination: '1414',
          dimensions: { weight: 1000, height: 20, width: 15, length: 10 },
        });
      },
    );

    assert.equal(result.outcome, 'account_not_activated');
    assert.equal(result.httpStatus, 202);
  });

  it('token OK + /rates con tarifas = la cotización funciona de verdad', async () => {
    const result = await withAdapter(
      gateway({
        status: 200,
        body: { rates: [rate()] },
      }),
      async (client) => {
        await client.probeAuth();
        return client.getRates({
          postalCodeOrigin: '1000',
          postalCodeDestination: '1414',
          dimensions: { weight: 1000, height: 20, width: 15, length: 10 },
        });
      },
    );

    assert.equal(result.outcome, 'ok');
    assert.equal(result.rates.length, 1);
  });

  it('probeAuth cachea el token: el paso 2 no vuelve a pedir uno', async () => {
    let tokenCalls = 0;
    await withAdapter(
      async (config) => {
        if (config.url?.includes('/token')) {
          tokenCalls += 1;
          return respond(config, 200, {
            token: 'jwt-de-prueba',
            expires: '2099-01-01 00:00:00',
          });
        }
        assert.equal(
          config.headers.Authorization,
          'Bearer jwt-de-prueba',
          'el /rates de la sonda tiene que ir con el JWT que ya trajo probeAuth',
        );
        return respond(config, 200, { rates: [rate()] });
      },
      async (client) => {
        await client.probeAuth();
        await client.getRates({
          postalCodeOrigin: '1000',
          postalCodeDestination: '1414',
          dimensions: { weight: 1000, height: 20, width: 15, length: 10 },
        });
      },
    );

    assert.equal(tokenCalls, 1);
  });
});

/**
 * A qué URL sale realmente el cliente de MiCorreo.
 *
 * Lo que hay que pinear acá y no en paqar: MiCorreo tiene su PROPIO override de
 * host (`CORREO_ARGENTINO_MICORREO_HOSTNAME`), con la cadena de fallback
 * propia → `CORREO_ARGENTINO_HOSTNAME` → derivado de `TEST_MODE`. El primer test
 * es de REGRESIÓN: sin nada seteado, la URL es la misma que con el path
 * hardcodeado.
 *
 * Se lee del `config` del adapter: es la URL que axios habría pedido de verdad.
 * Nada de esto salió a la red.
 */
describe('MiCorreoClient — la baseURL que resuelve', () => {
  const logger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  };

  /** Construye el cliente con las options dadas y devuelve la URL del /token. */
  const requestedUrl = async (
    rawOptions: Record<string, unknown>,
  ): Promise<string> => {
    let seen = '';
    const original = axios.defaults.adapter;
    axios.defaults.adapter = async (
      config: InternalAxiosRequestConfig,
    ): Promise<AxiosResponse> => {
      seen = `${config.baseURL ?? ''}${config.url ?? ''}`;
      return respondWith(config, {
        token: 'jwt-de-prueba',
        expires: '2099-01-01 00:00:00',
      });
    };
    try {
      const client = new MiCorreoClient(
        normalizeCorreoOptions({
          apiKey: 'k',
          agreement: 'a',
          micorreo: { username: 'u', password: 'p', customerId: 'c' },
          ...rawOptions,
        }),
        logger,
      );
      await client.probeAuth();
    } finally {
      axios.defaults.adapter = original;
    }
    return seen;
  };

  const respondWith = (
    config: InternalAxiosRequestConfig,
    data: unknown,
  ): AxiosResponse => ({
    data,
    status: 200,
    statusText: '',
    headers: {},
    config,
  });

  it('sin overrides es la de siempre: https://api…/micorreo/v1', async () => {
    assert.equal(
      await requestedUrl({}),
      'https://api.correoargentino.com.ar/micorreo/v1/token',
    );
  });

  it('sin override propio hereda el HOSTNAME general', async () => {
    assert.equal(
      await requestedUrl({ hostname: 'proxy.interno.example' }),
      'https://proxy.interno.example/micorreo/v1/token',
    );
  });

  // El caso real: el sandbox de MiCorreo no responde, así que se opera en test y
  // se cotiza en prod. Antes de esta variable no había forma de expresarlo.
  it('el override propio gana sobre el general y sobre testMode', async () => {
    assert.equal(
      await requestedUrl({
        testMode: 'true',
        hostname: 'paqar.interno.example',
        micorreoHostname: 'api.correoargentino.com.ar',
      }),
      'https://api.correoargentino.com.ar/micorreo/v1/token',
    );
  });

  it('el override de base path viaja hasta la request, normalizado', async () => {
    assert.equal(
      await requestedUrl({ micorreoBasePath: 'micorreo/v2/' }),
      'https://api.correoargentino.com.ar/micorreo/v2/token',
    );
  });

  it('un hostname con el esquema pegado no arma https://https://', async () => {
    assert.equal(
      await requestedUrl({ micorreoHostname: 'https://cotizador.example/algo' }),
      'https://cotizador.example/micorreo/v1/token',
    );
  });
});
