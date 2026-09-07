import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCorreoTrackingNumberDecision,
  buildCorreoTicketEntry,
  checkCorreoPostalCodeProvince,
  CORREO_TICKETS_METADATA_KEY,
  CORREO_TN_DEFAULT_PREFIX,
  correoPublicTrackingUrl,
  generateCorreoTrackingNumber,
  isCorreoDuplicateTrackingNumberError,
  isCorreoSelfGeneratedTnEnabled,
  isCorreoShippingMethod,
  latestCorreoTicket,
  mapCorreoOrderItems,
  prefixCorreoError,
  readCorreoTickets,
  resolveCorreoAgencyId,
  resolveCorreoDeliveryType,
  resolveCorreoServiceType,
  resolveCorreoTrackingNumber,
  resolveCorreoTrackingNumberFromResponse,
  validateCorreoOrderForTickets,
  warnUnverifiedCorreoServiceType,
  withPickupRetry,
  type CorreoOrderGraphLike,
  type CorreoTicketMetadataEntry,
  type ValidateCorreoOrderOptions,
} from './correo-generate-tickets.ts';
import { CORREO_MAX_TRACKING_NUMBER_LENGTH } from '../modules/correo-argentino-fulfillment/transformers/order-payload.ts';
import {
  buildCorreoOrderPayload,
  CorreoOrderPayloadError,
} from '../modules/correo-argentino-fulfillment/transformers/order-payload.ts';
import {
  CorreoAPIError,
  CorreoRateLimitError,
} from '../modules/correo-argentino-fulfillment/utils/errors.ts';
import {
  CorreoParcelLimitError,
  type ConsolidatedParcel,
} from '../modules/correo-argentino-fulfillment/transformers/consolidate-parcel.ts';
import { normalizeCorreoOptions } from '../modules/correo-argentino-fulfillment/env-options.ts';
import type {
  CorreoOrderPayload,
  CorreoProviderOptions,
} from '../modules/correo-argentino-fulfillment/types.ts';

// --- Fixtures ---

const options = (
  overrides: Record<string, unknown> = {},
): CorreoProviderOptions =>
  normalizeCorreoOptions({
    apiKey: 'test-key',
    agreement: '18018',
    sellerId: 'seller-1',
    testMode: 'true',
    sender: {
      name: 'Mercatto SA',
      email: 'envios@mercatto.test',
      phone: '011 4123-4567',
    },
    origin: {
      postalCode: '1757',
      street: 'Av. Siempre Viva',
      number: '742',
      city: 'Gregorio de Laferrere',
      state: 'B',
    },
    ...overrides,
  });

const parcel: ConsolidatedParcel = {
  dimensions: { height: 30, width: 20, depth: 15 },
  productWeightG: 2400,
  volumetricWeightG: 2250,
  billedWeightG: 2400,
  declaredValue: 10000,
  itemCount: 2,
};

const validateOptions = (
  overrides: Partial<ValidateCorreoOrderOptions> = {},
): ValidateCorreoOrderOptions => ({
  order_id: 'order_1',
  default_service_type: 'CP',
  ...overrides,
});

const shippingAddress = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  first_name: 'Juan',
  last_name: 'Pérez',
  address_1: 'Av. Corrientes',
  address_2: '1234',
  city: 'Ciudad Autónoma de Buenos Aires',
  province: 'CABA',
  // CPA completo: se normaliza a 1043, que está dentro del rango de CABA.
  postal_code: 'C1043AAZ',
  phone: '011 4123-4567',
  ...overrides,
});

const homeDeliveryMethod = {
  name: 'Correo Argentino a domicilio',
  data: {
    provider: 'correo_argentino',
    id: 'correo-domicilio',
    delivery_type: 'homeDelivery',
    service_type: 'CP',
  },
};

const baseOrder = (
  overrides: Partial<CorreoOrderGraphLike> = {},
): CorreoOrderGraphLike => ({
  id: 'order_1',
  display_id: 1234,
  email: 'cliente@test.com',
  metadata: {},
  shipping_address: shippingAddress(),
  items: [
    {
      id: 'li_1',
      product_id: 'prod_1',
      variant_id: 'var_1',
      title: 'Producto A',
      quantity: 2,
      unit_price: 5000,
      variant: { weight: 1.2, length: 20, width: 15, height: 10 },
    },
  ],
  shipping_methods: [homeDeliveryMethod],
  fulfillments: [{ id: 'ful_1', location_id: 'sloc_1' }],
  payment_collections: [{ status: 'completed' }],
  ...overrides,
});

const ticket = (
  overrides: Partial<CorreoTicketMetadataEntry> = {},
): CorreoTicketMetadataEntry => ({
  generated_at: '2026-08-01T12:00:00.000Z',
  tracking_number: 'CA000000001',
  tracking_url: correoPublicTrackingUrl('CA000000001'),
  seller_id: 'seller-1',
  agreement: '18018',
  service_type: 'CP',
  delivery_type: 'homeDelivery',
  parcel: {
    height: 30,
    width: 20,
    depth: 15,
    product_weight_g: 2400,
    volumetric_weight_g: 2250,
    billed_weight_g: 2400,
    declared_value: 10000,
    item_count: 2,
  },
  self_generated_tracking_number: false,
  sequence: 0,
  ...overrides,
});

/** Logger mínimo que junta lo que se logueó, para pinear los `warn`. */
function collectingLogger(): {
  warn: (message: string) => void;
  warnings: string[];
} {
  const warnings: string[] = [];
  return { warn: (message: string) => warnings.push(message), warnings };
}

/** Asserta que el error llega con el prefijo `CODIGO: ` que mapean las rutas. */
function assertErrorCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof Error, 'debe lanzar un Error');
    assert.ok(
      error.message.startsWith(`${code}: `),
      `esperaba prefijo "${code}:" y llegó: ${error.message}`,
    );
    return true;
  });
}

// ---------------------------------------------------------------------------
// validateCorreoOrderForTickets — una rama por prefijo de error
// ---------------------------------------------------------------------------

describe('validateCorreoOrderForTickets — prefijos de error', () => {
  it('ORDER_NOT_FOUND cuando la orden no existe', () => {
    assertErrorCode(
      () => validateCorreoOrderForTickets(undefined, validateOptions()),
      'ORDER_NOT_FOUND',
    );
    assertErrorCode(
      () => validateCorreoOrderForTickets(null, validateOptions()),
      'ORDER_NOT_FOUND',
    );
  });

  it('ORDER_NOT_FOUND cuando el registro llega sin id', () => {
    assertErrorCode(
      () => validateCorreoOrderForTickets({ display_id: 1 }, validateOptions()),
      'ORDER_NOT_FOUND',
    );
  });

  it('ORDER_NOT_PAID cuando ninguna payment_collection está cobrada', () => {
    for (const status of ['pending', 'canceled', 'requires_action']) {
      assertErrorCode(
        () =>
          validateCorreoOrderForTickets(
            baseOrder({ payment_collections: [{ status }] }),
            validateOptions(),
          ),
        'ORDER_NOT_PAID',
      );
    }
  });

  it('acepta completed, partially_captured y authorized como pagas', () => {
    for (const status of ['completed', 'partially_captured', 'authorized']) {
      const validated = validateCorreoOrderForTickets(
        baseOrder({ payment_collections: [{ status }] }),
        validateOptions(),
      );
      assert.equal(validated.skip_creation, false);
    }
  });

  it('ORDER_NOT_FULFILLED cuando la orden no tiene fulfillments', () => {
    assertErrorCode(
      () =>
        validateCorreoOrderForTickets(
          baseOrder({ fulfillments: [] }),
          validateOptions(),
        ),
      'ORDER_NOT_FULFILLED',
    );
  });

  it('ORDER_NOT_CORREO cuando ningún shipping method es de Correo', () => {
    assertErrorCode(
      () =>
        validateCorreoOrderForTickets(
          baseOrder({
            shipping_methods: [
              { name: 'Andreani Domicilio', data: { service_type: 'Domicilio' } },
            ],
          }),
          validateOptions(),
        ),
      'ORDER_NOT_CORREO',
    );
  });

  it('ORDER_MISSING_ITEMS cuando la orden no tiene líneas', () => {
    assertErrorCode(
      () =>
        validateCorreoOrderForTickets(
          baseOrder({ items: [] }),
          validateOptions(),
        ),
      'ORDER_MISSING_ITEMS',
    );
  });

  it('ORDER_MISSING_SHIPPING_ADDRESS cuando falta la dirección', () => {
    assertErrorCode(
      () =>
        validateCorreoOrderForTickets(
          baseOrder({ shipping_address: null }),
          validateOptions(),
        ),
      'ORDER_MISSING_SHIPPING_ADDRESS',
    );
  });

  it('CORREO_AGENCY_ID_MISSING cuando la opción es sucursal y no hay sucursal elegida', () => {
    assertErrorCode(
      () =>
        validateCorreoOrderForTickets(
          baseOrder({
            shipping_methods: [
              {
                name: 'Correo Argentino retiro en sucursal',
                data: {
                  provider: 'correo_argentino',
                  id: 'correo-sucursal',
                  delivery_type: 'agency',
                  service_type: 'CP',
                },
              },
            ],
          }),
          validateOptions(),
        ),
      'CORREO_AGENCY_ID_MISSING',
    );
  });

  it('CORREO_MISSING_RECIPIENT_NAME cuando no hay nombre ni empresa', () => {
    const address = shippingAddress();
    delete address.first_name;
    delete address.last_name;
    assertErrorCode(
      () =>
        validateCorreoOrderForTickets(
          baseOrder({ shipping_address: address }),
          validateOptions(),
        ),
      'CORREO_MISSING_RECIPIENT_NAME',
    );
  });

  it('CORREO_MISSING_RECIPIENT_STREET cuando falta address_1', () => {
    const address = shippingAddress();
    delete address.address_1;
    assertErrorCode(
      () =>
        validateCorreoOrderForTickets(
          baseOrder({ shipping_address: address }),
          validateOptions(),
        ),
      'CORREO_MISSING_RECIPIENT_STREET',
    );
  });

  it('CORREO_MISSING_RECIPIENT_CITY cuando falta la ciudad', () => {
    const address = shippingAddress();
    delete address.city;
    assertErrorCode(
      () =>
        validateCorreoOrderForTickets(
          baseOrder({ shipping_address: address }),
          validateOptions(),
        ),
      'CORREO_MISSING_RECIPIENT_CITY',
    );
  });

  it('CORREO_INVALID_PROVINCE cuando la provincia no se puede resolver a la letra', () => {
    assertErrorCode(
      () =>
        validateCorreoOrderForTickets(
          baseOrder({
            shipping_address: shippingAddress({ province: 'Montevideo' }),
          }),
          validateOptions(),
        ),
      'CORREO_INVALID_PROVINCE',
    );
  });

  it('CORREO_INVALID_POSTAL_CODE cuando el CP no son 4 dígitos', () => {
    assertErrorCode(
      () =>
        validateCorreoOrderForTickets(
          baseOrder({
            shipping_address: shippingAddress({ postal_code: '12' }),
          }),
          validateOptions(),
        ),
      'CORREO_INVALID_POSTAL_CODE',
    );
  });

  it('CORREO_POSTAL_CODE_PROVINCE_MISMATCH: un CP de CABA declarado en Provincia', () => {
    assertErrorCode(
      () =>
        validateCorreoOrderForTickets(
          baseOrder({
            shipping_address: shippingAddress({
              province: 'Buenos Aires',
              postal_code: '1043',
            }),
          }),
          validateOptions(),
        ),
      'CORREO_POSTAL_CODE_PROVINCE_MISMATCH',
    );
  });

  it('CORREO_POSTAL_CODE_PROVINCE_MISMATCH: CABA con un CP fuera de 1000-1499', () => {
    assertErrorCode(
      () =>
        validateCorreoOrderForTickets(
          baseOrder({
            shipping_address: shippingAddress({
              province: 'CABA',
              postal_code: '1757',
            }),
          }),
          validateOptions(),
        ),
      'CORREO_POSTAL_CODE_PROVINCE_MISMATCH',
    );
  });

  it('no inventa mismatch en provincias cuyo rango de CP no es asegurable', () => {
    const validated = validateCorreoOrderForTickets(
      baseOrder({
        shipping_address: shippingAddress({
          province: 'Córdoba',
          city: 'Córdoba',
          postal_code: '5000',
        }),
      }),
      validateOptions(),
    );
    assert.equal(validated.province_code, 'X');
    assert.equal(validated.postal_code, '5000');
  });
});

describe('validateCorreoOrderForTickets — camino feliz', () => {
  it('normaliza provincia, CP y nombre del destinatario', () => {
    const validated = validateCorreoOrderForTickets(
      baseOrder(),
      validateOptions(),
    );

    assert.equal(validated.order_id, 'order_1');
    assert.equal(validated.display_id, 1234);
    assert.equal(validated.email, 'cliente@test.com');
    assert.equal(validated.delivery_type, 'homeDelivery');
    assert.equal(validated.service_type, 'CP');
    assert.equal(validated.province_code, 'C');
    assert.equal(validated.postal_code, '1043');
    assert.equal(validated.recipient_name, 'Juan Pérez');
    assert.equal(validated.recipient_phone, '011 4123-4567');
    assert.equal(validated.skip_creation, false);
    assert.equal(validated.agency_id, undefined);
    assert.equal(validated.items.length, 1);
    assert.equal(validated.items[0]?.weight, 1.2);
  });

  it('resuelve la sucursal desde data.branch_code en una opción de agency', () => {
    const validated = validateCorreoOrderForTickets(
      baseOrder({
        shipping_methods: [
          {
            name: 'Correo Argentino retiro en sucursal',
            data: {
              carrier: 'correo_argentino',
              id: 'correo-sucursal',
              delivery_type: 'agency',
              service_type: 'CP',
              branch_code: 'SCQ',
              branch_id: '9999',
            },
          },
        ],
      }),
      validateOptions(),
    );

    assert.equal(validated.delivery_type, 'agency');
    // branch_code manda sobre branch_id: el agencyId de Correo es un código de
    // planta opaco de 3 chars, no un número.
    assert.equal(validated.agency_id, 'SCQ');
  });

  it('resuelve la sucursal desde la metadata de la orden cuando data no la trae', () => {
    const validated = validateCorreoOrderForTickets(
      baseOrder({
        metadata: { pickup_branch_code: 'MDQ' },
        shipping_methods: [
          {
            name: 'Correo Argentino retiro en sucursal',
            data: {
              provider: 'correo_argentino',
              id: 'correo-sucursal',
              delivery_type: 'agency',
            },
          },
        ],
      }),
      validateOptions(),
    );

    assert.equal(validated.agency_id, 'MDQ');
  });

  it('usa el serviceType de ENV cuando el shipping method no lo trae', () => {
    const validated = validateCorreoOrderForTickets(
      baseOrder({
        shipping_methods: [
          { name: 'Correo Argentino', data: { provider: 'correo_argentino' } },
        ],
      }),
      validateOptions({ default_service_type: 'EP' }),
    );
    assert.equal(validated.service_type, 'EP');
  });

  it('el company del destinatario sirve como nombre cuando no hay first/last name', () => {
    const address = shippingAddress({ company: 'Mercatto SRL' });
    delete address.first_name;
    delete address.last_name;
    const validated = validateCorreoOrderForTickets(
      baseOrder({ shipping_address: address }),
      validateOptions(),
    );
    assert.equal(validated.recipient_name, 'Mercatto SRL');
  });
});

// ---------------------------------------------------------------------------
// Idempotencia a nivel de orden
// ---------------------------------------------------------------------------

describe('idempotencia — una orden ya ticketeada no crea otro envío', () => {
  it('skip_creation = true cuando correo_tickets ya está poblado', () => {
    const existing = ticket();
    const validated = validateCorreoOrderForTickets(
      baseOrder({ metadata: { [CORREO_TICKETS_METADATA_KEY]: [existing] } }),
      validateOptions(),
    );

    assert.equal(validated.skip_creation, true);
    assert.equal(validated.existing_tickets.length, 1);
    assert.equal(
      validated.existing_tickets[0]?.tracking_number,
      existing.tracking_number,
    );
    // Se conserva la modalidad del último ticket, no el default de ENV.
    assert.equal(validated.delivery_type, 'homeDelivery');
    assert.equal(validated.service_type, 'CP');
  });

  it('el guard corta ANTES del resto de la validación (orden ya ticketeada e impaga)', () => {
    // Si el envío ya existe, que hoy falte un dato es irrelevante: no se debe
    // volver a pegarle a POST /orders ni fallar por ORDER_NOT_PAID.
    const validated = validateCorreoOrderForTickets(
      baseOrder({
        metadata: { [CORREO_TICKETS_METADATA_KEY]: [ticket()] },
        payment_collections: [{ status: 'pending' }],
        fulfillments: [],
        shipping_methods: [],
        items: [],
      }),
      validateOptions(),
    );
    assert.equal(validated.skip_creation, true);
  });

  it('force: true vuelve a validar todo y habilita la creación', () => {
    const validated = validateCorreoOrderForTickets(
      baseOrder({ metadata: { [CORREO_TICKETS_METADATA_KEY]: [ticket()] } }),
      validateOptions({ force: true }),
    );
    assert.equal(validated.skip_creation, false);
    assert.equal(validated.existing_tickets.length, 1);
  });

  it('force: true sobre una orden impaga sigue fallando', () => {
    assertErrorCode(
      () =>
        validateCorreoOrderForTickets(
          baseOrder({
            metadata: { [CORREO_TICKETS_METADATA_KEY]: [ticket()] },
            payment_collections: [{ status: 'pending' }],
          }),
          validateOptions({ force: true }),
        ),
      'ORDER_NOT_PAID',
    );
  });

  it('un correo_tickets basura no cuenta como ticket', () => {
    for (const raw of [null, 'nope', 42, [], [null, 'x']]) {
      const validated = validateCorreoOrderForTickets(
        baseOrder({ metadata: { [CORREO_TICKETS_METADATA_KEY]: raw } }),
        validateOptions(),
      );
      assert.equal(validated.skip_creation, false);
    }
  });
});

describe('readCorreoTickets / latestCorreoTicket', () => {
  it('devuelve [] para metadata ausente o con forma inesperada', () => {
    assert.deepEqual(readCorreoTickets(undefined), []);
    assert.deepEqual(readCorreoTickets(null), []);
    assert.deepEqual(readCorreoTickets({}), []);
    assert.deepEqual(
      readCorreoTickets({ [CORREO_TICKETS_METADATA_KEY]: 'nope' }),
      [],
    );
  });

  it('filtra entradas que no son objetos', () => {
    const tickets = readCorreoTickets({
      [CORREO_TICKETS_METADATA_KEY]: [ticket(), 'basura', null, 7],
    });
    assert.equal(tickets.length, 1);
  });

  it('latestCorreoTicket toma el más reciente por generated_at', () => {
    const older = ticket({
      generated_at: '2026-07-01T10:00:00.000Z',
      tracking_number: 'OLD',
    });
    const newer = ticket({
      generated_at: '2026-08-01T10:00:00.000Z',
      tracking_number: 'NEW',
    });
    assert.equal(latestCorreoTicket([newer, older])?.tracking_number, 'NEW');
    assert.equal(latestCorreoTicket([older, newer])?.tracking_number, 'NEW');
    assert.equal(latestCorreoTicket([]), undefined);
  });
});

// ---------------------------------------------------------------------------
// trackingNumber: generador determinístico + decisión por flag
// ---------------------------------------------------------------------------

describe('generateCorreoTrackingNumber — determinístico', () => {
  const seed = { order_id: 'order_01JABC', display_id: 1234, agreement: '18018' };

  it('dos llamadas con el mismo input devuelven el MISMO TN', () => {
    const first = generateCorreoTrackingNumber(seed);
    const second = generateCorreoTrackingNumber(seed);
    assert.equal(first, second);
    // Sin Math.random() ni timestamps: la tercera también.
    assert.equal(generateCorreoTrackingNumber(seed), first);
  });

  it('arranca con el prefijo y contiene el display_id', () => {
    const tn = generateCorreoTrackingNumber(seed);
    assert.ok(tn.startsWith(CORREO_TN_DEFAULT_PREFIX), tn);
    assert.ok(tn.includes('1234'), tn);
  });

  it('no supera los 30 chars ni con un display_id absurdo', () => {
    const tn = generateCorreoTrackingNumber({
      order_id: 'order_muy_largo_'.repeat(10),
      display_id: 99999999999999,
      agreement: 'AGREEMENT-LARGUISIMO',
      prefix: 'PREFIJO-DEMASIADO-LARGO',
    });
    assert.ok(tn.length <= CORREO_MAX_TRACKING_NUMBER_LENGTH, tn);
  });

  it('solo emite alfanuméricos en mayúscula', () => {
    const tn = generateCorreoTrackingNumber({
      ...seed,
      prefix: 'mérc-atto',
    });
    assert.match(tn, /^[A-Z0-9]+$/);
  });

  it('cambia con el order_id, con el agreement y con la secuencia', () => {
    const base = generateCorreoTrackingNumber(seed);
    assert.notEqual(
      generateCorreoTrackingNumber({ ...seed, order_id: 'order_otro' }),
      base,
    );
    assert.notEqual(
      generateCorreoTrackingNumber({ ...seed, agreement: '99999' }),
      base,
    );
    // Una regeneración (force) no puede colisionar con el primer envío.
    assert.notEqual(generateCorreoTrackingNumber({ ...seed, sequence: 1 }), base);
    // …pero el reintento de esa misma regeneración sí es idempotente.
    assert.equal(
      generateCorreoTrackingNumber({ ...seed, sequence: 1 }),
      generateCorreoTrackingNumber({ ...seed, sequence: 1 }),
    );
  });

  it('sequence 0 y sequence ausente son el mismo TN', () => {
    assert.equal(
      generateCorreoTrackingNumber(seed),
      generateCorreoTrackingNumber({ ...seed, sequence: 0 }),
    );
  });
});

describe('isCorreoSelfGeneratedTnEnabled — default false', () => {
  it('sin la env var está apagado', () => {
    assert.equal(isCorreoSelfGeneratedTnEnabled({}), false);
  });

  it('solo "true" lo prende', () => {
    assert.equal(
      isCorreoSelfGeneratedTnEnabled({
        CORREO_ARGENTINO_SELF_GENERATED_TN: 'true',
      }),
      true,
    );
    assert.equal(
      isCorreoSelfGeneratedTnEnabled({
        CORREO_ARGENTINO_SELF_GENERATED_TN: '  TRUE  ',
      }),
      true,
    );
    for (const value of ['false', '1', 'yes', 'si', '']) {
      assert.equal(
        isCorreoSelfGeneratedTnEnabled({
          CORREO_ARGENTINO_SELF_GENERATED_TN: value,
        }),
        false,
        `"${value}" no debería prender el flag`,
      );
    }
  });
});

describe('resolveCorreoTrackingNumber', () => {
  const seed = { order_id: 'order_1', display_id: 7, agreement: '18018' };

  it('por DEFAULT no genera TN: lo genera Correo', () => {
    const decision = resolveCorreoTrackingNumber(seed, {});
    assert.equal(decision.self_generated, false);
    assert.equal(decision.tracking_number, undefined);
  });

  it('con el flag en true genera un TN propio y determinístico', () => {
    const env = { CORREO_ARGENTINO_SELF_GENERATED_TN: 'true' };
    const first = resolveCorreoTrackingNumber(seed, env);
    const second = resolveCorreoTrackingNumber(seed, env);

    assert.equal(first.self_generated, true);
    assert.ok(first.tracking_number);
    assert.equal(first.tracking_number, second.tracking_number);
  });

  it('respeta CORREO_ARGENTINO_TN_PREFIX', () => {
    const decision = resolveCorreoTrackingNumber(seed, {
      CORREO_ARGENTINO_SELF_GENERATED_TN: 'true',
      CORREO_ARGENTINO_TN_PREFIX: 'MCT',
    });
    assert.ok(decision.tracking_number?.startsWith('MCT'), decision.tracking_number);
  });
});

describe('applyCorreoTrackingNumberDecision', () => {
  const payload = (): CorreoOrderPayload =>
    buildCorreoOrderPayload(
      {
        trackingNumber: 'MER1234ABCDEF',
        deliveryType: 'homeDelivery',
        parcel,
        recipient: {
          name: 'Juan Pérez',
          phone: '1141234567',
          address: {
            street: 'Av. Corrientes',
            number: '1234',
            city: 'CABA',
            state: 'C',
            postalCode: '1043',
          },
        },
      },
      options(),
    );

  it('el default OMITE la clave trackingNumber del payload', () => {
    const draft = applyCorreoTrackingNumberDecision(payload(), {
      self_generated: false,
    });
    // Omitida, no vacía: el manual no dice qué hace la API con un string vacío.
    assert.equal('trackingNumber' in draft, false);
    assert.equal(draft.sellerId, 'seller-1');
    assert.equal(draft.order.deliveryType, 'homeDelivery');
  });

  it('con TN propio el payload lo conserva', () => {
    const draft = applyCorreoTrackingNumberDecision(payload(), {
      self_generated: true,
      tracking_number: 'MER1234ABCDEF',
    });
    assert.equal(draft.trackingNumber, 'MER1234ABCDEF');
  });

  it('el payload original no se muta', () => {
    const original = payload();
    applyCorreoTrackingNumberDecision(original, { self_generated: false });
    assert.equal(original.trackingNumber, 'MER1234ABCDEF');
  });

  it('lo que llega al cliente mockeado no trae trackingNumber en la vía por default', async () => {
    const captured: unknown[] = [];
    const paqar = {
      createOrder: async (body: unknown) => {
        captured.push(body);
        return { trackingNumber: 'CA987654321' };
      },
    };
    const logger = collectingLogger();

    const decision = resolveCorreoTrackingNumber(
      { order_id: 'order_1', display_id: 1234, agreement: '18018' },
      {},
    );
    const draft = applyCorreoTrackingNumberDecision(payload(), decision);
    const response = await withPickupRetry(
      () => paqar.createOrder(draft),
      logger,
      'alta',
    );

    assert.equal(captured.length, 1);
    assert.equal(
      Object.prototype.hasOwnProperty.call(captured[0], 'trackingNumber'),
      false,
    );
    assert.equal(
      resolveCorreoTrackingNumberFromResponse(response, decision.tracking_number),
      'CA987654321',
    );
  });
});

describe('resolveCorreoTrackingNumberFromResponse', () => {
  it('el TN de la respuesta manda', () => {
    assert.equal(
      resolveCorreoTrackingNumberFromResponse({ trackingNumber: 'CA1' }, 'MER1'),
      'CA1',
    );
  });

  it('lee el TN anidado en order cuando no viene arriba', () => {
    assert.equal(
      resolveCorreoTrackingNumberFromResponse({ order: { trackingNumber: 'CA2' } }),
      'CA2',
    );
  });

  it('cae al TN que mandamos cuando la respuesta no lo trae', () => {
    assert.equal(resolveCorreoTrackingNumberFromResponse({}, 'MER1'), 'MER1');
    assert.equal(resolveCorreoTrackingNumberFromResponse(undefined, 'MER1'), 'MER1');
  });

  it('undefined cuando no hay ninguno de los dos', () => {
    assert.equal(resolveCorreoTrackingNumberFromResponse({}, '  '), undefined);
    assert.equal(resolveCorreoTrackingNumberFromResponse(undefined), undefined);
  });
});

describe('isCorreoDuplicateTrackingNumberError', () => {
  it('reconoce las variantes plausibles del error de duplicado', () => {
    const messages = [
      'CORREO_API_ERROR: Bad Request: El trackingNumber ya existe para el acuerdo',
      'Failed to create Correo Argentino order: numero de envio duplicado',
      'Duplicate tracking number for this order',
      'Número de orden repetido',
    ];
    for (const message of messages) {
      assert.equal(
        isCorreoDuplicateTrackingNumberError(message),
        true,
        message,
      );
    }
  });

  it('no confunde otros errores con un duplicado', () => {
    const messages = [
      'CORREO_API_ERROR: Unauthorized',
      // Errores de validación de campo genéricos: no conocemos los textos
      // reales que devuelve Correo, así que estos son ejemplos inventados a
      // propósito. Lo único que importa acá es que NO matcheen el detector de
      // duplicados.
      'Campo invalido: fuera de rango',
      'La sucursal no está habilitada para el acuerdo',
      'timeout of 30000ms exceeded',
    ];
    for (const message of messages) {
      assert.equal(
        isCorreoDuplicateTrackingNumberError(message),
        false,
        message,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// withPickupRetry
// ---------------------------------------------------------------------------

describe('withPickupRetry', () => {
  it('devuelve el resultado sin reintentar cuando no hay error', async () => {
    let calls = 0;
    const logger = collectingLogger();
    const result = await withPickupRetry(
      async () => {
        calls += 1;
        return 'ok';
      },
      logger,
      'alta',
    );
    assert.equal(result, 'ok');
    assert.equal(calls, 1);
    assert.equal(logger.warnings.length, 0);
  });

  it('reintenta un 503 y termina bien', async () => {
    let calls = 0;
    const logger = collectingLogger();
    const result = await withPickupRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw new CorreoAPIError('gateway caído', 503);
        return 'ok';
      },
      logger,
      'alta',
      2,
    );
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
    assert.equal(logger.warnings.length, 1);
    assert.match(logger.warnings[0] ?? '', /intento 1\/2/);
  });

  it('reintenta un timeout sin status (CorreoAPIError sin statusCode)', async () => {
    let calls = 0;
    const result = await withPickupRetry(
      async () => {
        calls += 1;
        if (calls < 2) throw new CorreoAPIError('timeout of 30000ms exceeded');
        return 'ok';
      },
      collectingLogger(),
      'alta',
      2,
    );
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  });

  it('reintenta un rate limit', async () => {
    let calls = 0;
    const result = await withPickupRetry(
      async () => {
        calls += 1;
        if (calls < 2) throw new CorreoRateLimitError('Rate limit exceeded', 1);
        return 'ok';
      },
      collectingLogger(),
      'alta',
      2,
    );
    assert.equal(calls, 2);
    assert.equal(result, 'ok');
  });

  it('NO reintenta un 4xx: es determinista', async () => {
    let calls = 0;
    const logger = collectingLogger();
    await assert.rejects(
      withPickupRetry(
        async () => {
          calls += 1;
          throw new CorreoAPIError('Bad Request: falta agencyId', 400);
        },
        logger,
        'alta',
        3,
      ),
      /falta agencyId/,
    );
    assert.equal(calls, 1, 'un 400 no se reintenta');
    assert.equal(logger.warnings.length, 0);
  });

  it('NO reintenta el 403 del gateway de paqar (devuelve 403 para cualquier path)', async () => {
    let calls = 0;
    await assert.rejects(
      withPickupRetry(
        async () => {
          calls += 1;
          throw new CorreoAPIError('Forbidden', 403);
        },
        collectingLogger(),
        'alta',
        3,
      ),
      /Forbidden/,
    );
    assert.equal(calls, 1);
  });

  it('reintenta el error REHIDRATADO por el workflow-engine (objeto plano, sin prototipo)', async () => {
    // El engine de Redis serializa el error del step: `instanceof Error` da
    // false y solo sobreviven `code` + `statusCode`.
    let calls = 0;
    const result = await withPickupRetry(
      async () => {
        calls += 1;
        if (calls < 2) {
          throw {
            name: 'CorreoAPIError',
            code: 'CORREO_API_ERROR',
            statusCode: 502,
            message: 'Bad Gateway',
          };
        }
        return 'ok';
      },
      collectingLogger(),
      'alta',
      2,
    );
    assert.equal(calls, 2);
    assert.equal(result, 'ok');
  });

  it('agota los intentos y re-lanza el último error transitorio', async () => {
    let calls = 0;
    const logger = collectingLogger();
    await assert.rejects(
      withPickupRetry(
        async () => {
          calls += 1;
          throw new CorreoAPIError('gateway caído', 500);
        },
        logger,
        'alta',
        2,
      ),
      /gateway caído/,
    );
    assert.equal(calls, 2);
    // El último intento no loguea reintento porque no hay reintento.
    assert.equal(logger.warnings.length, 1);
  });
});

// ---------------------------------------------------------------------------
// serviceType EP: pasa, pero avisa
// ---------------------------------------------------------------------------

describe('warnUnverifiedCorreoServiceType', () => {
  it('EP loguea un warn y deja pasar', () => {
    const logger = collectingLogger();
    const warned = warnUnverifiedCorreoServiceType('EP', logger, 'order_1');

    assert.equal(warned, true);
    assert.equal(logger.warnings.length, 1);
    assert.match(logger.warnings[0] ?? '', /EP/);
    assert.match(logger.warnings[0] ?? '', /SIN VERIFICAR/);
    assert.match(logger.warnings[0] ?? '', /order_1/);
  });

  it('CP no loguea nada', () => {
    const logger = collectingLogger();
    assert.equal(warnUnverifiedCorreoServiceType('CP', logger, 'order_1'), false);
    assert.equal(logger.warnings.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Detección y resolución del shipping method
// ---------------------------------------------------------------------------

describe('isCorreoShippingMethod', () => {
  it('reconoce el provider explícito', () => {
    assert.equal(
      isCorreoShippingMethod({ data: { provider: 'correo_argentino' } }),
      true,
    );
    assert.equal(
      isCorreoShippingMethod({ data: { carrier: 'correo_argentino' } }),
      true,
    );
    assert.equal(
      isCorreoShippingMethod({ provider_id: 'correo_argentino_correo_argentino' }),
      true,
    );
  });

  it('reconoce la fulfillment option por id', () => {
    assert.equal(isCorreoShippingMethod({ data: { id: 'correo-domicilio' } }), true);
    assert.equal(isCorreoShippingMethod({ data: { id: 'correo-sucursal' } }), true);
  });

  it('reconoce el nombre como último recurso', () => {
    assert.equal(
      isCorreoShippingMethod({ name: 'Correo Argentino Clásico' }),
      true,
    );
    assert.equal(isCorreoShippingMethod({ name: 'CORREO a domicilio' }), true);
  });

  it('no clasifica como Correo lo que no lo es', () => {
    assert.equal(isCorreoShippingMethod(undefined), false);
    assert.equal(isCorreoShippingMethod({}), false);
    assert.equal(
      isCorreoShippingMethod({
        name: 'Andreani Domicilio',
        data: { service_type: 'Domicilio' },
      }),
      false,
    );
    assert.equal(isCorreoShippingMethod({ name: 'Retiro en tienda' }), false);
    // "correos" no es el token "correo".
    assert.equal(isCorreoShippingMethod({ name: 'Envío por correos varios' }), false);
  });
});

describe('resolveCorreoDeliveryType', () => {
  it('lee data.delivery_type en sus tres convenciones', () => {
    for (const value of ['agency', 'S', 'sucursal', 'SUCURSAL']) {
      assert.equal(
        resolveCorreoDeliveryType({ data: { delivery_type: value } }),
        'agency',
        value,
      );
    }
    for (const value of ['homeDelivery', 'D', 'domicilio']) {
      assert.equal(
        resolveCorreoDeliveryType({ data: { delivery_type: value } }),
        'homeDelivery',
        value,
      );
    }
  });

  it('cae a la fulfillment option y después al nombre', () => {
    assert.equal(
      resolveCorreoDeliveryType({ data: { id: 'correo-sucursal' } }),
      'agency',
    );
    assert.equal(
      resolveCorreoDeliveryType({ name: 'Correo Argentino retiro en Sucursal' }),
      'agency',
    );
  });

  it('default homeDelivery: es la modalidad sin datos extra obligatorios', () => {
    assert.equal(resolveCorreoDeliveryType({}), 'homeDelivery');
    assert.equal(resolveCorreoDeliveryType(undefined), 'homeDelivery');
    assert.equal(resolveCorreoDeliveryType({ name: 'Correo Argentino' }), 'homeDelivery');
  });
});

describe('resolveCorreoServiceType', () => {
  it('acepta solo CP y EP', () => {
    assert.equal(resolveCorreoServiceType({ data: { service_type: 'cp' } }, 'EP'), 'CP');
    assert.equal(resolveCorreoServiceType({ data: { service_type: 'EP' } }, 'CP'), 'EP');
  });

  it('cualquier otro valor cae al default configurado', () => {
    assert.equal(resolveCorreoServiceType({ data: { service_type: 'HC' } }, 'CP'), 'CP');
    assert.equal(resolveCorreoServiceType({ data: { service_type: 'EE' } }, 'EP'), 'EP');
    assert.equal(resolveCorreoServiceType({}, 'EP'), 'EP');
  });
});

describe('resolveCorreoAgencyId', () => {
  it('prioriza agency_id, después branch_code y por último branch_id', () => {
    assert.equal(
      resolveCorreoAgencyId(
        { data: { agency_id: 'AAA', branch_code: 'BBB', branch_id: '1' } },
        {},
      ),
      'AAA',
    );
    assert.equal(
      resolveCorreoAgencyId({ data: { branch_code: 'BBB', branch_id: '1' } }, {}),
      'BBB',
    );
    assert.equal(resolveCorreoAgencyId({ data: { branch_id: '1' } }, {}), '1');
  });

  it('cae a la metadata de la orden', () => {
    assert.equal(
      resolveCorreoAgencyId({}, { correo_agency_id: 'SCQ' }),
      'SCQ',
    );
    assert.equal(
      resolveCorreoAgencyId({}, { pickup_branch_code: 'MDQ' }),
      'MDQ',
    );
  });

  it('convierte un branch_id numérico a string', () => {
    assert.equal(resolveCorreoAgencyId({ data: { branch_id: 501 } }, {}), '501');
  });

  it('undefined cuando no hay sucursal en ningún lado', () => {
    assert.equal(resolveCorreoAgencyId({}, {}), undefined);
    assert.equal(resolveCorreoAgencyId(undefined, undefined), undefined);
  });
});

// ---------------------------------------------------------------------------
// CP vs provincia
// ---------------------------------------------------------------------------

describe('checkCorreoPostalCodeProvince', () => {
  it('ok cuando el CP de CABA va con la provincia C', () => {
    assert.equal(checkCorreoPostalCodeProvince('1000', 'C'), 'ok');
    assert.equal(checkCorreoPostalCodeProvince('1043', 'C'), 'ok');
    assert.equal(checkCorreoPostalCodeProvince('1499', 'c'), 'ok');
  });

  it('mismatch en las dos direcciones del rango de CABA', () => {
    assert.equal(checkCorreoPostalCodeProvince('1043', 'B'), 'mismatch');
    assert.equal(checkCorreoPostalCodeProvince('1757', 'C'), 'mismatch');
    assert.equal(checkCorreoPostalCodeProvince('5000', 'C'), 'mismatch');
  });

  it('unknown fuera del rango de CABA: no se asevera lo que no es contiguo', () => {
    assert.equal(checkCorreoPostalCodeProvince('1757', 'B'), 'unknown');
    assert.equal(checkCorreoPostalCodeProvince('5000', 'X'), 'unknown');
    // 2600 es Santa Fe y 2700 es Buenos Aires: ninguna de las dos se asevera.
    assert.equal(checkCorreoPostalCodeProvince('2600', 'S'), 'unknown');
    assert.equal(checkCorreoPostalCodeProvince('2700', 'B'), 'unknown');
  });

  it('unknown cuando el CP no es un CP argentino de 4 dígitos', () => {
    assert.equal(checkCorreoPostalCodeProvince('', 'C'), 'unknown');
    assert.equal(checkCorreoPostalCodeProvince('999', 'C'), 'unknown');
    assert.equal(checkCorreoPostalCodeProvince('abcd', 'C'), 'unknown');
  });
});

// ---------------------------------------------------------------------------
// mapCorreoOrderItems
// ---------------------------------------------------------------------------

describe('mapCorreoOrderItems', () => {
  it('busca dimensiones en variante → producto → item', () => {
    const [fromVariant, fromProduct, fromItem] = mapCorreoOrderItems([
      { id: '1', variant: { weight: 2 }, product: { weight: 9 }, weight: 9 },
      { id: '2', variant: {}, product: { weight: 3 }, weight: 9 },
      { id: '3', weight: 4 },
    ]);

    assert.equal(fromVariant?.weight, 2);
    assert.equal(fromProduct?.weight, 3);
    assert.equal(fromItem?.weight, 4);
  });

  it('devuelve 0 cuando no hay dato en ninguna capa (lo valida consolidateParcel)', () => {
    const [item] = mapCorreoOrderItems([{ id: '1' }]);
    assert.equal(item?.weight, 0);
    assert.equal(item?.length, 0);
    assert.equal(item?.quantity, 1);
  });

  it('tolera un items que no es array', () => {
    assert.deepEqual(mapCorreoOrderItems(undefined), []);
    assert.deepEqual(mapCorreoOrderItems('nope'), []);
  });
});

// ---------------------------------------------------------------------------
// El objeto que va a order.metadata.correo_tickets[]
// ---------------------------------------------------------------------------

describe('buildCorreoTicketEntry', () => {
  const built = buildCorreoTicketEntry({
    tracking_number: 'CA987654321',
    options: { sellerId: 'seller-1', agreement: '18018' },
    service_type: 'CP',
    delivery_type: 'agency',
    agency_id: 'SCQ',
    parcel,
    self_generated: false,
    sequence: 0,
    generated_at: new Date('2026-08-04T15:30:00.000Z'),
  });

  it('cumple el contrato mínimo que consume el storefront', () => {
    // lib/util/get-tracking.ts ordena por generated_at y arma la URL con
    // tracking_number: los dos tienen que existir y ser strings.
    assert.equal(typeof built.tracking_number, 'string');
    assert.equal(typeof built.generated_at, 'string');
    assert.equal(built.generated_at, '2026-08-04T15:30:00.000Z');
    assert.ok(!Number.isNaN(new Date(built.generated_at).getTime()));
    // Nada de placeholders PENDING-*: el storefront los filtra a mano.
    assert.equal(built.tracking_number.startsWith('PENDING-'), false);
  });

  it('guarda la URL pública de seguimiento', () => {
    assert.equal(
      built.tracking_url,
      'https://www.correoargentino.com.ar/formularios/e-commerce?id=CA987654321',
    );
  });

  it('congela el bulto declarado, con el peso FACTURADO', () => {
    assert.deepEqual(built.parcel, {
      height: 30,
      width: 20,
      depth: 15,
      product_weight_g: 2400,
      volumetric_weight_g: 2250,
      billed_weight_g: 2400,
      declared_value: 10000,
      item_count: 2,
    });
  });

  it('registra modalidad, sucursal, acuerdo y de quién es el TN', () => {
    assert.equal(built.service_type, 'CP');
    assert.equal(built.delivery_type, 'agency');
    assert.equal(built.agency_id, 'SCQ');
    assert.equal(built.seller_id, 'seller-1');
    assert.equal(built.agreement, '18018');
    assert.equal(built.self_generated_tracking_number, false);
    assert.equal(built.sequence, 0);
  });

  it('omite agency_id en homeDelivery y recovered_from_duplicate cuando no aplica', () => {
    const home = buildCorreoTicketEntry({
      tracking_number: 'CA1',
      options: { sellerId: 's', agreement: 'a' },
      service_type: 'CP',
      delivery_type: 'homeDelivery',
      parcel,
      self_generated: true,
      sequence: 1,
    });
    assert.equal('agency_id' in home, false);
    assert.equal('recovered_from_duplicate' in home, false);
    assert.equal(home.self_generated_tracking_number, true);
    assert.equal(home.sequence, 1);
  });

  it('marca recovered_from_duplicate cuando se adoptó un envío ya existente', () => {
    const recovered = buildCorreoTicketEntry({
      tracking_number: 'MER1234ABCDEF',
      options: { sellerId: 's', agreement: 'a' },
      service_type: 'CP',
      delivery_type: 'homeDelivery',
      parcel,
      self_generated: true,
      sequence: 0,
      recovered_from_duplicate: true,
    });
    assert.equal(recovered.recovered_from_duplicate, true);
  });

  it('el ticket sobrevive el round-trip por JSON de order.metadata', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(built)), built);
  });
});

// ---------------------------------------------------------------------------
// Clasificación de errores para las rutas admin
// ---------------------------------------------------------------------------

describe('prefixCorreoError', () => {
  it('usa el .code de los errores tipados de la Fase 1', () => {
    const limit = new CorreoParcelLimitError(
      'weight',
      30000,
      25000,
      'billed weight 30000g exceeds the 25000g limit',
    );
    assert.match(
      prefixCorreoError(limit, 'CORREO_PARCEL_INVALID').message,
      /^CORREO_PARCEL_LIMIT_EXCEEDED: /,
    );

    const payloadError = new CorreoOrderPayloadError('agencyId', 'agencyId is required');
    assert.match(
      prefixCorreoError(payloadError, 'CORREO_PARCEL_INVALID').message,
      /^CORREO_ORDER_PAYLOAD_INVALID: /,
    );
  });

  it('usa el fallbackCode cuando el error no trae code', () => {
    assert.match(
      prefixCorreoError(new Error('boom'), 'CORREO_PARCEL_INVALID').message,
      /^CORREO_PARCEL_INVALID: boom$/,
    );
  });

  it('no duplica el prefijo si el mensaje ya viene prefijado', () => {
    const already = new Error('CORREO_PARCEL_INVALID: boom');
    assert.equal(
      prefixCorreoError(already, 'CORREO_PARCEL_INVALID').message,
      'CORREO_PARCEL_INVALID: boom',
    );
  });

  it('lee el code de un error REHIDRATADO (objeto plano envuelto por el engine)', () => {
    const rehydrated = {
      error: {
        name: 'CorreoMissingProductDimensionsError',
        code: 'CORREO_MISSING_PRODUCT_DIMENSIONS',
        message: 'faltan dimensiones en 2 productos',
      },
    };
    assert.equal(
      prefixCorreoError(rehydrated, 'CORREO_PARCEL_INVALID').message,
      'CORREO_MISSING_PRODUCT_DIMENSIONS: faltan dimensiones en 2 productos',
    );
  });
});

// ---------------------------------------------------------------------------
// URL pública
// ---------------------------------------------------------------------------

describe('correoPublicTrackingUrl', () => {
  it('arma la URL del formulario de e-commerce', () => {
    assert.equal(
      correoPublicTrackingUrl('CA123456789'),
      'https://www.correoargentino.com.ar/formularios/e-commerce?id=CA123456789',
    );
  });

  it('escapa el TN', () => {
    assert.equal(
      correoPublicTrackingUrl('CA 123&x'),
      'https://www.correoargentino.com.ar/formularios/e-commerce?id=CA%20123%26x',
    );
  });
});
