import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import CorreoArgentinoFulfillmentProviderService, {
  CORREO_CARRIER_ID,
  getCorreoRateFallbackCount,
  resetCorreoRateFallbackCount,
} from './service.ts';

type LogEntry = { level: string; message: string };

function makeLogger() {
  const entries: LogEntry[] = [];
  const push = (level: string) => (message: string) =>
    entries.push({ level, message: String(message) });
  return {
    entries,
    logger: {
      info: push('info'),
      warn: push('warn'),
      error: push('error'),
      debug: push('debug'),
    },
  };
}

const BASE_OPTIONS = {
  apiKey: 'eyJfake',
  agreement: '20168',
  origin: { postalCode: '1414', street: 'Av Corrientes', number: '1234', city: 'CABA', state: 'C' },
};

const QUOTABLE_OPTIONS = {
  ...BASE_OPTIONS,
  micorreo: { username: 'u', password: 'p', customerId: '0000550137' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeService(options: Record<string, unknown> = BASE_OPTIONS): any {
  const { logger, entries } = makeLogger();
  const service = new CorreoArgentinoFulfillmentProviderService(
    { logger } as never,
    options,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (service as any).__logs = entries;
  return service;
}

const CART_ITEM = {
  id: 'item_1',
  title: 'Remera',
  quantity: 2,
  weight: 0.3,
  length: 20,
  width: 15,
  height: 3,
  unit_price: 12000,
};

beforeEach(() => resetCorreoRateFallbackCount());

describe('getFulfillmentOptions', () => {
  it('expone domicilio y sucursal, y NADA de locker', async () => {
    const options = await makeService().getFulfillmentOptions();
    assert.deepEqual(
      options.map((o: { id: string }) => o.id),
      ['correo-domicilio', 'correo-sucursal'],
    );
    // Los SmartLockers figuran como "currently unavailable" y /agencies no
    // tiene forma de distinguirlos: no se ofrecen.
    assert.equal(
      options.some((o: { delivery_type: string }) => o.delivery_type === 'locker'),
      false,
    );
  });

  it('cada opción lleva su delivery_type y el service_type configurado', async () => {
    const service = makeService({ ...BASE_OPTIONS, serviceType: 'EP' });
    const options = await service.getFulfillmentOptions();
    assert.equal(options[0].delivery_type, 'homeDelivery');
    assert.equal(options[1].delivery_type, 'agency');
    assert.equal(options[0].service_type, 'EP');
  });
});

describe('validateOption', () => {
  it('acepta los ids conocidos y rechaza los ajenos', async () => {
    const service = makeService();
    assert.equal(await service.validateOption({ id: 'correo-domicilio' }), true);
    assert.equal(await service.validateOption({ id: 'correo-sucursal' }), true);
    assert.equal(await service.validateOption({ id: 'andreani-domicilio' }), false);
  });
});

describe('validateFulfillmentData', () => {
  it('estampa carrier + provider + delivery_type + service_type', async () => {
    const data = await makeService().validateFulfillmentData(
      { id: 'correo-domicilio' },
      {},
      {} as never,
    );

    assert.equal(data.carrier, CORREO_CARRIER_ID);
    assert.equal(data.provider, 'correo_argentino');
    assert.equal(data.delivery_type, 'homeDelivery');
    assert.equal(data.service_type, 'CP');
  });

  it('deriva el delivery_type del id de la opción', async () => {
    const data = await makeService().validateFulfillmentData(
      { id: 'correo-sucursal' },
      { agency_id: 'DFB' },
      {} as never,
    );
    assert.equal(data.delivery_type, 'agency');
    assert.equal(data.agency_id, 'DFB');
  });

  // ⚠️ NO valida que haya sucursal, aunque POST /orders la exija — y es a
  // propósito. El checkout llama a setShippingMethod DOS veces: primero al
  // tocar el radio, sin sucursal (`shipping/index.tsx:1113-1124`), y después
  // con la sucursal elegida (`:908-926`). Tirar acá haría que la opción de
  // retiro no se pueda seleccionar nunca.
  //
  // La validación real vive en el completado del carrito y en el workflow de
  // tickets, que son los puntos donde la elección ya es definitiva.
  it('sucursal sin agency_id NO falla: el checkout la setea en dos pasos', async () => {
    const data = await makeService().validateFulfillmentData(
      { id: 'correo-sucursal' },
      {},
      {} as never,
    );
    assert.equal(data.delivery_type, 'agency');
    assert.equal(data.agency_id, undefined);
  });

  it('preserva lo que el checkout ya mandó en data en vez de pisarlo', async () => {
    const data = await makeService().validateFulfillmentData(
      { id: 'correo-sucursal' },
      { branch_code: 'DFB', pickup_kind: 'carrier', amount: 4200 },
      {} as never,
    );
    assert.equal(data.branch_code, 'DFB');
    assert.equal(data.pickup_kind, 'carrier');
    assert.equal(data.amount, 4200);
  });

  // `branch_code` y `branch_id` son los que manda HOY el checkout después de la
  // Fase 0 (`shipping/index.tsx:910-924`). Si el provider no los leyera, la
  // sucursal elegida no llegaría nunca a `agency_id` y `POST /orders` fallaría
  // recién al generar el rótulo de una orden ya pagada.
  it('acepta los alias de agency_id que ya usa el storefront', async () => {
    for (const key of [
      'agency_id',
      'branch_code',
      'branch_id',
      'pickup_location_id',
      'pickup_branch_id',
    ]) {
      const data = await makeService().validateFulfillmentData(
        { id: 'correo-sucursal' },
        { [key]: 'SCQ' },
        {} as never,
      );
      assert.equal(data.agency_id, 'SCQ', key);
    }
  });

  it('agency_id explícito gana sobre branch_code', async () => {
    const data = await makeService().validateFulfillmentData(
      { id: 'correo-sucursal' },
      { agency_id: 'SCQ', branch_code: 'DFB' },
      {} as never,
    );
    assert.equal(data.agency_id, 'SCQ');
  });

  // La cadena de fallbacks importa: la opción sembrada trae el service_type en
  // `optionData`, el checkout puede pisarlo por `data`, y si no viene ninguno
  // manda el default configurado por env.
  it('resuelve service_type por la cadena data → metadata → optionData → options', async () => {
    const service = makeService({ ...BASE_OPTIONS, serviceType: 'CP' });

    const fromData = await service.validateFulfillmentData(
      { id: 'correo-domicilio', service_type: 'CP' },
      { service_type: 'ep' },
      {} as never,
    );
    assert.equal(fromData.service_type, 'EP', 'data gana y se normaliza a mayúsculas');

    const fromMetadata = await service.validateFulfillmentData(
      { id: 'correo-domicilio', service_type: 'CP' },
      { metadata: { service_type: 'EP' } },
      {} as never,
    );
    assert.equal(fromMetadata.service_type, 'EP', 'metadata gana sobre optionData');

    const fromOption = await service.validateFulfillmentData(
      { id: 'correo-domicilio', service_type: 'EP' },
      {},
      {} as never,
    );
    assert.equal(fromOption.service_type, 'EP', 'optionData gana sobre el default');

    // Un valor que no es CP ni EP no se propaga: cae al default configurado.
    const fromOptions = await service.validateFulfillmentData(
      { id: 'correo-domicilio', service_type: 'Paq.ar Hoy' },
      {},
      {} as never,
    );
    assert.equal(fromOptions.service_type, 'CP');
  });

  it('domicilio no exige sucursal', async () => {
    const data = await makeService().validateFulfillmentData(
      { id: 'correo-domicilio' },
      {},
      {} as never,
    );
    assert.equal(data.agency_id, undefined);
  });
});

describe('calculatePrice — cotización exitosa', () => {
  it('consolida el carrito, cotiza y devuelve el precio redondeado', async () => {
    const service = makeService(QUOTABLE_OPTIONS);
    let captured: Record<string, unknown> | undefined;

    service.getMiCorreoClient().getRates = async (request: Record<string, unknown>) => {
      captured = request;
      return {
        outcome: 'ok',
        httpStatus: 200,
        rates: [
          { productType: 'CP', deliveredType: 'D', price: 5432.7, productName: 'Clasico' },
          { productType: 'CP', deliveredType: 'S', price: 4200, productName: 'Clasico Sucursal' },
        ],
      };
    };

    const price = await service.calculatePrice(
      { id: 'correo-domicilio' },
      {},
      { shipping_address: { postal_code: 'C1121AAF' }, items: [CART_ITEM] },
    );

    assert.equal(price.calculated_amount, 5433);
    // Pineado a `false` por decisión de negocio (alinear con Andreani). Está
    // SIN VERIFICAR si `/rates` devuelve precio final o neto: si algún día se
    // confirma que es final, este assert y los dos returns de `calculatePrice`
    // son el único lugar a cambiar.
    assert.equal(price.is_calculated_price_tax_inclusive, false);
    assert.equal(getCorreoRateFallbackCount(), 0);

    // El CPA del carrito se reduce a 4 dígitos; el origen sale de las options.
    assert.equal(captured?.postalCodeDestination, '1121');
    assert.equal(captured?.postalCodeOrigin, '1414');
    // homeDelivery → D. Sin esto la API devuelve las dos modalidades.
    assert.equal(captured?.deliveredType, 'D');
    // 2 unidades × 300 g = 600 g de peso real.
    assert.equal(
      (captured?.dimensions as { weight: number }).weight >= 600,
      true,
    );
  });

  it('sucursal cotiza con deliveredType S y elige esa tarifa', async () => {
    const service = makeService(QUOTABLE_OPTIONS);
    service.getMiCorreoClient().getRates = async () => ({
      outcome: 'ok',
      httpStatus: 200,
      rates: [
        { productType: 'CP', deliveredType: 'D', price: 5432, productName: 'D' },
        { productType: 'CP', deliveredType: 'S', price: 4200, productName: 'S' },
      ],
    });

    const price = await service.calculatePrice(
      { id: 'correo-sucursal' },
      { agency_id: 'DFB' },
      { shipping_address: { postal_code: '1121' }, items: [CART_ITEM] },
    );

    assert.equal(price.calculated_amount, 4200);
  });
});

describe('calculatePrice — lectura del carrito', () => {
  // ⚠️ `quantity` y `unit_price` de las líneas del carrito son BigNumberValue:
  // pueden llegar como el objeto de BigNumber. Con `Number(objeto)` daría NaN y
  // la cantidad caería a 1 EN SILENCIO — se cotizaría el peso de UNA unidad y la
  // diferencia la factura Correo después. Es el tipo de bug que no se ve nunca.
  it('entiende quantity como BigNumber además de número y string', async () => {
    for (const quantity of [3, '3', { numeric: 3 }, { value: '3' }]) {
      const service = makeService(QUOTABLE_OPTIONS);
      let captured: Record<string, unknown> | undefined;
      service.getMiCorreoClient().getRates = async (req: Record<string, unknown>) => {
        captured = req;
        return { outcome: 'ok', httpStatus: 200, rates: [{ productType: 'CP', deliveredType: 'D', price: 100 }] };
      };

      await service.calculatePrice(
        { id: 'correo-domicilio' },
        {},
        {
          shipping_address: { postal_code: '1121' },
          items: [{ ...CART_ITEM, quantity }],
        },
      );

      // 3 unidades × 300 g = 900 g de peso real, por encima del volumétrico.
      assert.equal(
        (captured?.dimensions as { weight: number }).weight,
        900,
        `quantity=${JSON.stringify(quantity)}`,
      );
    }
  });

  // Medusa expone las dimensiones en la VARIANTE, no en la línea.
  it('lee las dimensiones de la variante cuando la línea no las trae', async () => {
    const service = makeService(QUOTABLE_OPTIONS);
    let captured: Record<string, unknown> | undefined;
    service.getMiCorreoClient().getRates = async (req: Record<string, unknown>) => {
      captured = req;
      return { outcome: 'ok', httpStatus: 200, rates: [{ productType: 'CP', deliveredType: 'D', price: 100 }] };
    };

    await service.calculatePrice(
      { id: 'correo-domicilio' },
      {},
      {
        shipping_address: { postal_code: '1121' },
        items: [
          {
            id: 'item_1',
            title: 'Remera',
            quantity: 2,
            variant: { id: 'v1', weight: 0.3, length: 20, width: 15, height: 3 },
          },
        ],
      },
    );

    assert.equal((captured?.dimensions as { weight: number }).weight, 600);
  });
});

describe('calculatePrice — degradación a $0 (D4)', () => {
  // La decisión del negocio es mostrar "Gratuito" en vez de romper el checkout.
  // El riesgo está aceptado; lo que NO es negociable es que se vea en los logs
  // y se cuente.
  const expectFallback = async (
    service: ReturnType<typeof makeService>,
    context: unknown,
  ) => {
    const before = getCorreoRateFallbackCount();
    const price = await service.calculatePrice(
      { id: 'correo-domicilio' },
      {},
      context,
    );
    assert.equal(price.calculated_amount, 0);
    assert.equal(getCorreoRateFallbackCount(), before + 1);
    assert.equal(
      service.__logs.some(
        (e: LogEntry) => e.level === 'error' && e.message.includes('degradó a $0'),
      ),
      true,
      'la degradación tiene que loguearse con severidad error',
    );
  };

  it('sin credenciales de MiCorreo', async () => {
    const service = makeService(BASE_OPTIONS);
    await expectFallback(service, {
      shipping_address: { postal_code: '1121' },
      items: [CART_ITEM],
    });
  });

  it('sin código postal de destino', async () => {
    const service = makeService(QUOTABLE_OPTIONS);
    service.getMiCorreoClient().getRates = async () => {
      throw new Error('no debería llamarse');
    };
    await expectFallback(service, { items: [CART_ITEM] });
  });

  it('cuando /rates tira (timeout, 500, lo que sea)', async () => {
    const service = makeService(QUOTABLE_OPTIONS);
    service.getMiCorreoClient().getRates = async () => {
      throw new Error('ETIMEDOUT');
    };
    await expectFallback(service, {
      shipping_address: { postal_code: '1121' },
      items: [CART_ITEM],
    });
  });

  it('cuando la cuenta no está activada (202 con rates vacío)', async () => {
    const service = makeService(QUOTABLE_OPTIONS);
    service.getMiCorreoClient().getRates = async () => ({
      outcome: 'account_not_activated',
      httpStatus: 202,
      rates: [],
    });
    await expectFallback(service, {
      shipping_address: { postal_code: '1121' },
      items: [CART_ITEM],
    });
  });

  it('cuando faltan dimensiones de producto y el fallback está apagado', async () => {
    const service = makeService(QUOTABLE_OPTIONS);
    service.getMiCorreoClient().getRates = async () => {
      throw new Error('no debería llamarse');
    };
    await expectFallback(service, {
      shipping_address: { postal_code: '1121' },
      items: [{ id: 'i1', title: 'Sin dimensiones', quantity: 1 }],
    });
  });

  // D4b: el log es la ÚNICA mitigación del riesgo aceptado, así que tiene que
  // alcanzar para reproducir la cotización a mano contra /rates. Sin el outcome,
  // el CP y el peso, un "Gratuito" en producción no se puede diagnosticar.
  it('el log de la degradación lleva outcome, CP destino y peso', async () => {
    const service = makeService(QUOTABLE_OPTIONS);
    service.getMiCorreoClient().getRates = async () => ({
      outcome: 'no_rates',
      httpStatus: 200,
      rates: [],
    });

    await service.calculatePrice(
      { id: 'correo-domicilio' },
      {},
      { shipping_address: { postal_code: 'C1121AAF' }, items: [CART_ITEM] },
    );

    const log = service.__logs.find(
      (e: LogEntry) => e.level === 'error' && e.message.includes('degradó a $0'),
    );
    assert.ok(log, 'falta el log de degradación');
    assert.match(log.message, /outcome=no_rates/);
    assert.match(log.message, /cp_destino=1121/);
    assert.match(log.message, /peso_g=\d+/);
    assert.match(log.message, /delivery=homeDelivery/);
  });

  // Cuando ni se llegó a llamar a la API, el outcome no es `no_rates`: es otro
  // problema y el log tiene que distinguirlo.
  it('sin llamada a la API el log dice sin_respuesta y sin_cp', async () => {
    const service = makeService(QUOTABLE_OPTIONS);
    await service.calculatePrice({ id: 'correo-domicilio' }, {}, {
      items: [CART_ITEM],
    });

    const log = service.__logs.find(
      (e: LogEntry) => e.level === 'error' && e.message.includes('degradó a $0'),
    );
    assert.ok(log);
    assert.match(log.message, /outcome=sin_respuesta/);
    assert.match(log.message, /cp_destino=sin_cp/);
    assert.match(log.message, /peso_g=sin_bulto/);
  });

  it('el contador acumula entre llamadas (es lo que se va a medir)', async () => {
    const service = makeService(BASE_OPTIONS);
    const context = {
      shipping_address: { postal_code: '1121' },
      items: [CART_ITEM],
    };
    await service.calculatePrice({ id: 'correo-domicilio' }, {}, context);
    await service.calculatePrice({ id: 'correo-domicilio' }, {}, context);
    assert.equal(getCorreoRateFallbackCount(), 2);
  });
});

describe('canQuote', () => {
  it('sin credenciales de MiCorreo el provider arranca igual, pero avisa fuerte', () => {
    const service = makeService(BASE_OPTIONS);
    assert.equal(service.canQuote(), false);
    assert.equal(
      service.__logs.some(
        (e: LogEntry) => e.level === 'error' && e.message.includes('Sin credenciales de MiCorreo'),
      ),
      true,
    );
  });

  it('con las tres credenciales completas, cotiza', () => {
    assert.equal(makeService(QUOTABLE_OPTIONS).canQuote(), true);
  });

  it('con credenciales incompletas NO cotiza (customerId es tan obligatorio como el resto)', () => {
    const service = makeService({
      ...BASE_OPTIONS,
      micorreo: { username: 'u', password: 'p' },
    });
    assert.equal(service.canQuote(), false);
  });
});

describe('createFulfillment — stub deliberado', () => {
  const order = { id: 'order_1', display_id: 42, shipping_address: { city: 'CABA' } };
  const items = [{ id: 'fi_1' }];

  it('no inventa un tracking placeholder: el TN lo asigna el workflow', async () => {
    const result = await makeService().createFulfillment(
      { id: 'correo-domicilio' },
      items,
      order,
      { id: 'ful_1' },
    );

    assert.equal(result.data.tracking_number, null);
    assert.equal(result.data.status, 'pending_label');
    assert.equal(result.data.carrier, CORREO_CARRIER_ID);
    assert.deepEqual(result.labels, []);
  });

  it('conserva la sucursal elegida para que el workflow la use', async () => {
    const result = await makeService().createFulfillment(
      { id: 'correo-sucursal', agency_id: 'DFB' },
      items,
      order,
      {},
    );
    assert.equal(result.data.delivery_type, 'agency');
    assert.equal(result.data.agency_id, 'DFB');
  });

  it('sin orden, sin dirección o sin ítems no sigue', async () => {
    const service = makeService();
    await assert.rejects(() => service.createFulfillment({}, items, undefined, {}));
    await assert.rejects(() =>
      service.createFulfillment({}, items, { id: 'o' }, {}),
    );
    await assert.rejects(() => service.createFulfillment({}, [], order, {}));
  });
});

describe('cancelFulfillment', () => {
  it('sin tracking_number no le pega a Correo: no hay envío que cancelar', async () => {
    const service = makeService();
    service.getPaqarClient().cancelOrder = async () => {
      throw new Error('no debería llamarse');
    };

    const result = await service.cancelFulfillment({});
    assert.equal(result.success, true);
    assert.equal(result.cancelled_remotely, false);
  });

  it('con tracking_number cancela en Correo', async () => {
    const service = makeService();
    let cancelled: string | undefined;
    service.getPaqarClient().cancelOrder = async (tn: string) => {
      cancelled = tn;
      return { codigo: 200, mensaje: 'OK' };
    };

    const result = await service.cancelFulfillment({ tracking_number: 'CA123' });
    assert.equal(cancelled, 'CA123');
    assert.equal(result.cancelled_remotely, true);
  });

  // ⚠️ Después de la imposición Correo rechaza la cancelación. Devolver
  // success:true dejaría al operador creyendo que canceló un envío que sale
  // igual, con la orden ya cancelada de este lado.
  it('si Correo rechaza, PROPAGA el error con un mensaje accionable', async () => {
    const service = makeService();
    service.getPaqarClient().cancelOrder = async () => {
      throw new Error('El envío ya fue impuesto');
    };

    await assert.rejects(
      () => service.cancelFulfillment({ tracking_number: 'CA123' }),
      /ya fue impuesto.*ejecutivo de cuenta/s,
    );
  });
});
