import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@medusajs/framework/types';
import { ContabiliumErpAdapter } from './contabilium.ts';
import { ErpAuthError, ErpConnectionError, ErpNonRetryableError, type AdapterContext } from './types.ts';
import type { ErpContabiliumSettings, ErpSalePayload } from '../types.ts';

const logger = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;

function ctx(
  contabilium: ErpContabiliumSettings = {},
  credentials: Record<string, string> = { client_id: 'demo@mail.com', client_secret: 'apikey' }
): AdapterContext {
  return { credentials, settings: { contabilium }, countryCode: 'AR', logger };
}

type Call = { url: URL; method: string; body: unknown; headers: Record<string, string> };

/**
 * Fake fetch que resuelve `/token` solo (token-1, token-2, ... por emisión) y
 * delega el resto al handler. Registra todas las llamadas.
 */
function fakeFetch(handler: (url: URL, init: RequestInit, call: Call) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  let tokens = 0;
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>)
    );
    const rawBody = init?.body ? String(init.body) : undefined;
    let parsedBody: unknown = rawBody;
    if (rawBody && headers['Content-Type'] === 'application/json') {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = rawBody;
      }
    }
    const call: Call = { url, method: init?.method ?? 'GET', body: parsedBody, headers };
    calls.push(call);

    let result: { status: number; body: unknown };
    if (url.pathname === '/token') {
      tokens += 1;
      result = { status: 200, body: { access_token: `token-${tokens}`, token_type: 'bearer', expires_in: 86399 } };
    } else {
      result = handler(url, init ?? {}, call);
    }
    const text = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      text: async () => text,
      json: async () => JSON.parse(text),
    } as Response;
  }) as typeof globalThis.fetch;
  return { impl, calls, tokenCount: () => tokens };
}

const salePayload: ErpSalePayload = {
  event_key: 'sale_created:contabilium:order_1',
  order_id: 'order_1',
  display_id: 456,
  created_at: '2026-07-06T15:00:00Z',
  country_code: 'AR',
  currency_code: 'ars',
  customer: {
    id: 'cus_1',
    email: 'juan@test.com.ar',
    first_name: 'Juan',
    last_name: 'Pérez',
    phone: '+5491155551234',
    document: { type: 'DNI', number: '38566200' },
  },
  items: [
    { sku: 'PROD1', title: 'Producto uno', quantity: 2, unit_price: 1210, total: 2420 },
    { sku: 'PROD2', title: 'Producto dos', quantity: 1, unit_price: 605, total: 605 },
  ],
  totals: { subtotal: 3025, discount: 0, shipping: 121, tax: 0, total: 3146 },
  payment: { provider_id: 'pp_mercadopago', captured_amount: 3146, currency_code: 'ars' },
  shipping: {
    method: 'Andreani',
    address: {
      street: 'Suipacha 245',
      city: 'CABA',
      province: 'Buenos Aires',
      postal_code: 'C1008',
      country_code: 'ar',
    },
  },
};

describe('ContabiliumErpAdapter — token', () => {
  it('pide el token con form-urlencoded y lo cachea entre llamadas', async () => {
    const { impl, calls, tokenCount } = fakeFetch(() => ({ status: 200, body: { RazonSocial: 'Demo SRL' } }));
    const adapter = new ContabiliumErpAdapter(impl);
    await adapter.validateCredentials(ctx());
    await adapter.validateCredentials(ctx());

    assert.equal(tokenCount(), 1); // cacheado
    const tokenCall = calls[0]!;
    assert.equal(tokenCall.url.pathname, '/token');
    assert.equal(tokenCall.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.match(String(tokenCall.body), /grant_type=client_credentials/);
    assert.match(String(tokenCall.body), /client_id=demo%40mail.com/);
    // Y el request de API va con Bearer
    const apiCall = calls.find((c) => c.url.pathname === '/api/usuarios/obtenerinfo')!;
    assert.equal(apiCall.headers.Authorization, 'Bearer token-1');
  });

  it('un 401 de la API renueva el token una vez y reintenta', async () => {
    let apiHits = 0;
    const { impl, tokenCount } = fakeFetch((url) => {
      if (url.pathname === '/api/usuarios/obtenerinfo') {
        apiHits += 1;
        return apiHits === 1
          ? { status: 401, body: 'expired' }
          : { status: 200, body: { RazonSocial: 'Demo SRL' } };
      }
      return { status: 404, body: '' };
    });
    const result = await new ContabiliumErpAdapter(impl).validateCredentials(ctx());
    assert.equal(result.ok, true);
    assert.equal(tokenCount(), 2);
    assert.equal(apiHits, 2);
  });

  it('credenciales rechazadas en /token → ok:false', async () => {
    const impl = (async (input: string | URL) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, '/token');
      return {
        ok: false,
        status: 400,
        text: async () => '{"error":"invalid_client"}',
        json: async () => ({ error: 'invalid_client' }),
      } as Response;
    }) as typeof globalThis.fetch;
    const result = await new ContabiliumErpAdapter(impl).validateCredentials(ctx());
    assert.equal(result.ok, false);
    assert.match(result.message ?? '', /credenciales rechazadas/i);
  });

  it('sin client_id/client_secret → mensaje claro', async () => {
    const { impl } = fakeFetch(() => ({ status: 200, body: {} }));
    const result = await new ContabiliumErpAdapter(impl).validateCredentials(ctx({}, {}));
    assert.equal(result.ok, false);
    assert.match(result.message ?? '', /client_id.*client_secret/);
  });
});

describe('ContabiliumErpAdapter — validateCredentials', () => {
  it('verifica el depósito configurado contra getDepositos', async () => {
    const { impl } = fakeFetch((url) => {
      if (url.pathname === '/api/usuarios/obtenerinfo') {
        return { status: 200, body: { RazonSocial: 'Demo SRL', CUIT: '30708951842' } };
      }
      if (url.pathname === '/api/inventarios/getDepositos') {
        return { status: 200, body: [{ Id: 31293, Nombre: 'PRINCIPAL', Activo: true }] };
      }
      return { status: 404, body: '' };
    });
    const adapter = new ContabiliumErpAdapter(impl);
    const ok = await adapter.validateCredentials(ctx({ deposito_id: 31293 }));
    assert.equal(ok.ok, true);
    assert.match(ok.message ?? '', /31293 verificado/);

    const bad = await adapter.validateCredentials(ctx({ deposito_id: 999 }));
    assert.equal(bad.ok, false);
    assert.match(bad.message ?? '', /999 no existe/);
  });
});

describe('ContabiliumErpAdapter — getStockBySku (pocos: getStockBySKU)', () => {
  const stockBody = {
    Id: 10535931,
    Codigo: 'PROD1',
    StockActual: 1050,
    StockReservado: 41,
    StockConReservas: 1009,
    stock: [
      { Id: 49858, Codigo: 'Primero', StockActual: 1000, StockReservado: 29, StockConReservas: 971 },
      { Id: 50715, Codigo: 'Secundario', StockActual: 50, StockReservado: 12, StockConReservas: 38 },
    ],
  };

  it('usa StockConReservas total sin depósito, o el del depósito configurado', async () => {
    const { impl } = fakeFetch((url) =>
      url.searchParams.get('codigo') === 'PROD1' ? { status: 200, body: stockBody } : { status: 404, body: '' }
    );
    const adapter = new ContabiliumErpAdapter(impl);

    const total = await adapter.getStockBySku(['PROD1'], ctx());
    assert.deepEqual(total.get('PROD1'), { found: true, quantity: 1009 });

    const porDeposito = await adapter.getStockBySku(['PROD1'], ctx({ deposito_id: 50715 }));
    assert.deepEqual(porDeposito.get('PROD1'), { found: true, quantity: 38 });

    // Depósito configurado sin fila en el desglose → 0 (no not_found: el SKU existe)
    const sinFila = await adapter.getStockBySku(['PROD1'], ctx({ deposito_id: 777 }));
    assert.deepEqual(sinFila.get('PROD1'), { found: true, quantity: 0 });
  });

  it('404 o 4xx puntual en un código → not_found sin abortar', async () => {
    const { impl } = fakeFetch((url) => {
      const codigo = url.searchParams.get('codigo');
      if (codigo === 'PROD1') return { status: 200, body: stockBody };
      if (codigo === 'MALO') return { status: 400, body: 'sku inválido' };
      return { status: 404, body: '' };
    });
    const stock = await new ContabiliumErpAdapter(impl).getStockBySku(['PROD1', 'NOEXISTE', 'MALO'], ctx());
    assert.equal(stock.get('PROD1')!.found, true);
    assert.deepEqual(stock.get('NOEXISTE'), { found: false });
    assert.deepEqual(stock.get('MALO'), { found: false });
  });

  it('matching case-insensitive (Contabilium normaliza a mayúsculas)', async () => {
    const { impl, calls } = fakeFetch((url) =>
      url.searchParams.get('codigo') === 'PROD1' ? { status: 200, body: stockBody } : { status: 404, body: '' }
    );
    const stock = await new ContabiliumErpAdapter(impl).getStockBySku(['prod1'], ctx());
    assert.equal(calls.find((c) => c.url.pathname.includes('getStockBySKU'))!.url.searchParams.get('codigo'), 'PROD1');
    assert.deepEqual(stock.get('prod1'), { found: true, quantity: 1009 });
  });
});

describe('ContabiliumErpAdapter — getStockBySku (catálogo: barrido por depósito)', () => {
  it('pagina getStockByDeposito y resuelve depósitos activos cuando no hay configurado', async () => {
    const manySkus = Array.from({ length: 30 }, (_, i) => `SKU-${i}`);
    const pageA = Array.from({ length: 50 }, (_, i) => ({
      Id: i,
      Codigo: `SKU-${i % 25}`,
      StockConReservas: 1,
    }));
    const pageB = [{ Id: 900, Codigo: 'SKU-25', StockConReservas: 7 }];
    const { impl, calls } = fakeFetch((url) => {
      if (url.pathname === '/api/inventarios/getDepositos') {
        return {
          status: 200,
          body: [
            { Id: 31293, Nombre: 'PRINCIPAL', Activo: true },
            { Id: 40549, Nombre: 'INACTIVO', Activo: false },
          ],
        };
      }
      if (url.pathname === '/api/inventarios/getStockByDeposito') {
        assert.equal(url.searchParams.get('id'), '31293'); // solo el activo
        const page = Number(url.searchParams.get('page'));
        return { status: 200, body: { Items: page === 0 ? pageA : pageB } };
      }
      return { status: 404, body: '' };
    });

    const stock = await new ContabiliumErpAdapter(impl).getStockBySku(manySkus, ctx());
    const sweepCalls = calls.filter((c) => c.url.pathname === '/api/inventarios/getStockByDeposito');
    assert.equal(sweepCalls.length, 2); // 2 páginas, no 30 requests
    assert.deepEqual(stock.get('SKU-0'), { found: true, quantity: 2 }); // 2 filas sumadas
    assert.deepEqual(stock.get('SKU-25'), { found: true, quantity: 7 });
    assert.deepEqual(stock.get('SKU-29'), { found: false });
  });
});

describe('ContabiliumErpAdapter — notifySale (orden_venta, default)', () => {
  function saleHandler(overrides: { clientFound?: boolean } = {}) {
    return (url: URL, _init: RequestInit, call: Call): { status: number; body: unknown } => {
      if (url.pathname === '/api/clientes/GetClientByDoc') {
        return overrides.clientFound === false
          ? { status: 200, body: [] }
          : { status: 200, body: [{ Id: 945603, RazonSocial: 'Juan Pérez' }] };
      }
      if (url.pathname === '/api/clientes' && call.method === 'POST') {
        return { status: 200, body: '52514829' };
      }
      if (url.pathname === '/api/conceptos/getByCodigo') {
        const codigo = url.searchParams.get('codigo');
        if (codigo === 'PROD1') return { status: 200, body: { Id: 111, Codigo: 'PROD1' } };
        if (codigo === 'PROD2') return { status: 200, body: { Id: 222, Codigo: 'PROD2' } };
        if (codigo === 'ENVIO') return { status: 200, body: { Id: 333, Codigo: 'ENVIO' } };
        return { status: 404, body: '' };
      }
      if (url.pathname === '/api/ordenesVenta' && call.method === 'POST') {
        return { status: 200, body: '44744305' };
      }
      return { status: 404, body: '' };
    };
  }

  it('sin deposito_id → ErpNonRetryableError', async () => {
    const { impl } = fakeFetch(saleHandler());
    await assert.rejects(
      new ContabiliumErpAdapter(impl).notifySale(salePayload, ctx({})),
      ErpNonRetryableError
    );
  });

  it('crea la orden con cliente existente, conceptos resueltos y netos /1.21', async () => {
    const { impl, calls } = fakeFetch(saleHandler());
    const result = await new ContabiliumErpAdapter(impl).notifySale(
      salePayload,
      ctx({ deposito_id: 31293, shipping_concept_sku: 'ENVIO' })
    );

    assert.equal(result.status, 'sent');
    assert.equal(result.external_ref, '44744305');
    const orden = calls.find((c) => c.url.pathname === '/api/ordenesVenta')!;
    const body = orden.body as Record<string, any>;
    assert.equal(body.idCliente, 945603);
    assert.equal(body.IDInventario, 31293);
    // 1210 / 1.21 = 1000 neto
    assert.deepEqual(body.items[0], { idConcepto: 111, cantidad: 2, precioUnitario: 1000 });
    // Envío como concepto configurado: 121 / 1.21 = 100
    assert.deepEqual(body.items[2], { idConcepto: 333, cantidad: 1, precioUnitario: 100 });
    assert.match(body.observaciones, /Venta web #456/);
  });

  it('cliente inexistente → lo crea por doc y usa el Id devuelto (número plano)', async () => {
    const { impl, calls } = fakeFetch(saleHandler({ clientFound: false }));
    await new ContabiliumErpAdapter(impl).notifySale(salePayload, ctx({ deposito_id: 31293 }));
    const create = calls.find((c) => c.url.pathname === '/api/clientes' && c.method === 'POST')!;
    const body = create.body as Record<string, any>;
    assert.equal(body.TipoDoc, 'DNI');
    assert.equal(body.NroDoc, '38566200');
    assert.equal(body.Personeria, 'F');
    const orden = calls.find((c) => c.url.pathname === '/api/ordenesVenta')!;
    assert.equal((orden.body as any).idCliente, 52514829);
  });

  it('sin documento y sin default_client_id → ErpNonRetryableError; con default lo usa', async () => {
    const anon: ErpSalePayload = {
      ...salePayload,
      customer: { ...salePayload.customer, document: { type: null, number: null } },
    };
    const { impl, calls } = fakeFetch(saleHandler());
    const adapter = new ContabiliumErpAdapter(impl);
    await assert.rejects(adapter.notifySale(anon, ctx({ deposito_id: 31293 })), ErpNonRetryableError);

    await adapter.notifySale(anon, ctx({ deposito_id: 31293, default_client_id: 777 }));
    const orden = calls.find((c) => c.url.pathname === '/api/ordenesVenta')!;
    assert.equal((orden.body as any).idCliente, 777);
    // Sin concepto de envío configurado, el costo va en observaciones.
    assert.match((orden.body as any).observaciones, /Envío: \$121/);
  });

  it('SKU sin concepto en Contabilium → ErpNonRetryableError', async () => {
    const { impl } = fakeFetch((url, init, call) => {
      if (url.pathname === '/api/clientes/GetClientByDoc') return { status: 200, body: [{ Id: 1 }] };
      if (url.pathname === '/api/conceptos/getByCodigo') return { status: 404, body: '' };
      return saleHandler()(url, init, call);
    });
    await assert.rejects(
      new ContabiliumErpAdapter(impl).notifySale(salePayload, ctx({ deposito_id: 31293 })),
      (error: Error) => error instanceof ErpNonRetryableError && /PROD1/.test(error.message)
    );
  });
});

describe('ContabiliumErpAdapter — notifySale (factura_cobrada)', () => {
  const feCtx = () =>
    ctx({
      deposito_id: 49858,
      sale_mode: 'factura_cobrada',
      punto_venta_id: 59419,
      tipo_fc: 'FCB',
      condicion_venta: 'MercadoPago',
    });

  function feHandler(fe: { status: number; body: unknown }) {
    return (url: URL, _init: RequestInit, call: Call): { status: number; body: unknown } => {
      if (url.pathname === '/api/clientes/GetClientByDoc') return { status: 200, body: [{ Id: 46183388 }] };
      if (url.pathname === '/api/conceptos/getByCodigo') {
        return { status: 200, body: { Id: 10535931 } };
      }
      if (url.pathname === '/api/comprobantes/emitirFECobrada' && call.method === 'POST') return fe;
      return { status: 404, body: '' };
    };
  }

  it('sin punto_venta_id → ErpNonRetryableError', async () => {
    const { impl } = fakeFetch(feHandler({ status: 200, body: {} }));
    await assert.rejects(
      new ContabiliumErpAdapter(impl).notifySale(
        salePayload,
        ctx({ deposito_id: 49858, sale_mode: 'factura_cobrada' })
      ),
      ErpNonRetryableError
    );
  });

  it('emite la FE con RefExterna, envío como ítem libre y devuelve numero/cae', async () => {
    const { impl, calls } = fakeFetch(
      feHandler({
        status: 200,
        body: {
          idComprobante: 83235921,
          errores: '',
          cae: '73310106064724',
          numero: '0001-00024619',
          url: 'https://clientes.contabilium.com/public/factura?x=1',
        },
      })
    );
    const result = await new ContabiliumErpAdapter(impl).notifySale(salePayload, feCtx());

    assert.equal(result.status, 'sent');
    assert.equal(result.external_ref, '0001-00024619');
    assert.equal((result.response as any).cae, '73310106064724');
    const fe = calls.find((c) => c.url.pathname === '/api/comprobantes/emitirFECobrada')!;
    const body = fe.body as Record<string, any>;
    assert.equal(body.TipoFc, 'FCB');
    assert.equal(body.PuntoVenta, 59419);
    assert.equal(body.Inventario, 49858);
    assert.equal(body.CondicionVenta, 'MercadoPago');
    assert.equal(body.RefExterna, 'order_1');
    assert.equal(body.Items[0].IdConcepto, 10535931);
    assert.equal(body.Items[0].Iva, 21);
    assert.equal(body.Items[0].PrecioUnitario, 1000);
    // Envío sin concepto configurado → ítem libre (los comprobantes lo permiten)
    const envio = body.Items[2];
    assert.equal(envio.IdConcepto, undefined);
    assert.equal(envio.Concepto, 'Costo de envío');
    assert.equal(envio.PrecioUnitario, 100);
  });

  it('errores en la respuesta → ErpNonRetryableError (rechazo AFIP/validación)', async () => {
    const { impl } = fakeFetch(
      feHandler({ status: 200, body: { idComprobante: 0, errores: 'CUIT inválido' } })
    );
    await assert.rejects(
      new ContabiliumErpAdapter(impl).notifySale(salePayload, feCtx()),
      (error: Error) => error instanceof ErpNonRetryableError && /CUIT inválido/.test(error.message)
    );
  });

  it('5xx al emitir → ErpConnectionError (reintenta)', async () => {
    const { impl } = fakeFetch(feHandler({ status: 500, body: 'oops' }));
    await assert.rejects(new ContabiliumErpAdapter(impl).notifySale(salePayload, feCtx()), ErpConnectionError);
  });

  it('ErpAuthError si la API rechaza el acceso tras renovar token', async () => {
    const { impl } = fakeFetch((url) => {
      if (url.pathname === '/api/clientes/GetClientByDoc') return { status: 401, body: 'nope' };
      return { status: 404, body: '' };
    });
    // 401 → renueva token → 401 de nuevo (retryOn401 agotado) → ErpAuthError
    await assert.rejects(
      new ContabiliumErpAdapter(impl).notifySale(salePayload, feCtx()),
      ErpAuthError
    );
  });
});
