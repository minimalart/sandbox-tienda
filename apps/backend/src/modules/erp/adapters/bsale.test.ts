import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@medusajs/framework/types';
import { BsaleErpAdapter } from './bsale.ts';
import { ErpAuthError, ErpConnectionError, ErpNonRetryableError, type AdapterContext } from './types.ts';
import type { ErpBsaleSettings, ErpSalePayload } from '../types.ts';

const logger = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;

function ctx(bsale: ErpBsaleSettings = {}, credentials: Record<string, string> = { access_token: 'tok' }): AdapterContext {
  return { credentials, settings: { bsale }, countryCode: 'CL', logger };
}

type Call = { url: URL; method: string; body: unknown };

/** Fake fetch: rutea por path+query y registra las llamadas. */
function fakeFetch(handler: (url: URL, init: RequestInit) => { status: number; json: unknown }) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const result = handler(url, init ?? {});
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => result.json,
    } as Response;
  }) as typeof globalThis.fetch;
  return { impl, calls };
}

const stockItem = (code: string, quantityAvailable: number, office = 1) => ({
  quantityAvailable,
  quantity: quantityAvailable,
  quantityReserved: 0,
  variant: { id: 1, code },
  office: { id: office },
});

const salePayload: ErpSalePayload = {
  event_key: 'sale_created:bsale:order_1',
  order_id: 'order_1',
  display_id: 123,
  created_at: '2026-07-06T12:00:00Z',
  country_code: 'CL',
  currency_code: 'clp',
  customer: {
    id: 'cus_1',
    email: 'cliente@test.cl',
    first_name: 'Ana',
    last_name: 'Pérez',
    phone: '+56911111111',
    document: { type: 'RUT', number: '12345678-5' },
  },
  items: [
    { sku: 'SKU-A', title: 'Producto A', quantity: 2, unit_price: 11900, total: 23800 },
    { sku: 'SKU-B', title: 'Producto B', quantity: 1, unit_price: 5950, total: 5950 },
  ],
  totals: { subtotal: 29750, discount: 0, shipping: 3570, tax: 0, total: 33320 },
  payment: { provider_id: 'pp_system', captured_amount: 33320, currency_code: 'clp' },
  shipping: {
    method: 'Envío estándar',
    address: {
      street: 'Av. Providencia 123',
      city: 'Santiago',
      province: 'RM',
      postal_code: null,
      country_code: 'cl',
    },
  },
};

describe('BsaleErpAdapter — auth y validación', () => {
  it('sin access_token → falla la validación con mensaje claro', async () => {
    const adapter = new BsaleErpAdapter(fakeFetch(() => ({ status: 200, json: {} })).impl);
    const result = await adapter.validateCredentials(ctx({}, {}));
    assert.equal(result.ok, false);
    assert.match(result.message ?? '', /access_token/);
  });

  it('valida contra /v1/offices.json con el header access-token', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, json: { count: 2, items: [{ id: 1 }] } }));
    const adapter = new BsaleErpAdapter(impl);
    const result = await adapter.validateCredentials(ctx());
    assert.equal(result.ok, true);
    assert.match(result.message ?? '', /2 sucursales/);
    assert.equal(calls[0]!.url.pathname, '/v1/offices.json');
  });

  it('office_id configurada se verifica y su 404 falla la validación', async () => {
    const { impl } = fakeFetch((url) =>
      url.pathname === '/v1/offices/9.json'
        ? { status: 404, json: { error: 'office not found' } }
        : { status: 200, json: { count: 1, items: [{ id: 1 }] } }
    );
    const adapter = new BsaleErpAdapter(impl);
    const result = await adapter.validateCredentials(ctx({ office_id: 9 }));
    assert.equal(result.ok, false);
    assert.match(result.message ?? '', /office not found/);
  });

  it('401 → ok:false con mensaje de credenciales', async () => {
    const { impl } = fakeFetch(() => ({ status: 401, json: { error: 'invalid token' } }));
    const result = await new BsaleErpAdapter(impl).validateCredentials(ctx());
    assert.equal(result.ok, false);
    assert.match(result.message ?? '', /credenciales inválidas/);
  });
});

describe('BsaleErpAdapter — getStockBySku (pocos SKUs: por code)', () => {
  it('consulta code por code, suma sucursales y marca not found', async () => {
    const { impl, calls } = fakeFetch((url) => {
      const code = url.searchParams.get('code');
      if (code === 'SKU-A') {
        return { status: 200, json: { count: 2, items: [stockItem('SKU-A', 3, 1), stockItem('SKU-A', 2, 2)] } };
      }
      return { status: 200, json: { count: 0, items: [] } };
    });
    const adapter = new BsaleErpAdapter(impl);
    const stock = await adapter.getStockBySku(['SKU-A', 'SKU-X'], ctx());
    assert.deepEqual(stock.get('SKU-A'), { found: true, quantity: 5 });
    assert.deepEqual(stock.get('SKU-X'), { found: false });
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.url.pathname, '/v1/stocks.json');
  });

  it('con office_id manda officeid en la query', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, json: { items: [stockItem('A', 7)] } }));
    await new BsaleErpAdapter(impl).getStockBySku(['A'], ctx({ office_id: 4 }));
    assert.equal(calls[0]!.url.searchParams.get('officeid'), '4');
  });

  it('sanitiza SKUs con saltos de línea (gotcha aec)', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, json: { items: [stockItem('A', 1)] } }));
    const stock = await new BsaleErpAdapter(impl).getStockBySku(['A\r\n'], ctx());
    assert.equal(calls[0]!.url.searchParams.get('code'), 'A');
    assert.deepEqual(stock.get('A\r\n'), { found: true, quantity: 1 });
  });

  it('errores de conexión y auth abortan (los tipa para el sync)', async () => {
    const boom = new BsaleErpAdapter((async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof globalThis.fetch);
    await assert.rejects(boom.getStockBySku(['A'], ctx()), ErpConnectionError);

    const { impl } = fakeFetch(() => ({ status: 403, json: { error: 'nope' } }));
    await assert.rejects(new BsaleErpAdapter(impl).getStockBySku(['A'], ctx()), ErpAuthError);
  });
});

describe('BsaleErpAdapter — getStockBySku (catálogo: barrido paginado)', () => {
  it('pagina con limit/offset + expand=[variant] y suma por code', async () => {
    const manySkus = Array.from({ length: 30 }, (_, i) => `SKU-${i}`);
    const pageA = Array.from({ length: 50 }, (_, i) => stockItem(`SKU-${i % 25}`, 1));
    const pageB = [stockItem('SKU-25', 9), stockItem('SKU-26', 4)];
    const { impl, calls } = fakeFetch((url) => {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return { status: 200, json: { count: 52, limit: 50, offset, items: offset === 0 ? pageA : pageB } };
    });
    const adapter = new BsaleErpAdapter(impl);
    const stock = await adapter.getStockBySku(manySkus, ctx());

    assert.equal(calls.length, 2); // 52 filas → 2 páginas, no 30 requests
    assert.equal(calls[0]!.url.searchParams.get('expand'), '[variant]');
    assert.deepEqual(stock.get('SKU-0'), { found: true, quantity: 2 }); // 2 filas sumadas
    assert.deepEqual(stock.get('SKU-25'), { found: true, quantity: 9 });
    assert.deepEqual(stock.get('SKU-29'), { found: false }); // no vino en el barrido
  });
});

describe('BsaleErpAdapter — notifySale', () => {
  it('sin document_type_id → ErpNonRetryableError (dead_letter directo)', async () => {
    const { impl } = fakeFetch(() => ({ status: 200, json: {} }));
    await assert.rejects(
      new BsaleErpAdapter(impl).notifySale(salePayload, ctx({})),
      ErpNonRetryableError
    );
  });

  it('emite el documento con netos /1.19, envío como línea, cliente RUT y pago', async () => {
    const { impl, calls } = fakeFetch(() => ({
      status: 201,
      json: { id: 99, number: 1234, urlPdf: 'https://pdf', urlPublicView: 'https://view', informedSii: 0 },
    }));
    const adapter = new BsaleErpAdapter(impl);
    const result = await adapter.notifySale(
      salePayload,
      ctx({
        document_type_id: 8,
        office_id: 2,
        price_list_id: 3,
        payment_type_id: 5,
        dispatch_stock: true,
        declare_sii: false,
      })
    );

    assert.equal(result.status, 'sent');
    assert.equal(result.external_ref, '99');
    const call = calls[0]!;
    assert.equal(call.url.pathname, '/v1/documents.json');
    assert.equal(call.method, 'POST');
    const body = call.body as Record<string, any>;
    assert.equal(body.documentTypeId, 8);
    assert.equal(body.officeId, 2);
    assert.equal(body.priceListId, 3);
    assert.equal(body.declareSii, 0);
    assert.equal(body.dispatch, 1);
    // 11900 / 1.19 = 10000 neto
    assert.equal(body.details[0].code, 'SKU-A');
    assert.equal(body.details[0].netUnitValue, 10000);
    assert.equal(body.details[0].taxId, '[1]');
    // Envío 3570 / 1.19 = 3000 como línea extra
    const shippingLine = body.details[2];
    assert.equal(shippingLine.netUnitValue, 3000);
    assert.equal(shippingLine.comment, 'Costo de envío');
    // Cliente por RUT normalizado
    assert.equal(body.client.code, '12345678-5');
    assert.equal(body.client.city, 'Santiago');
    // Pago redondeado (CLP sin decimales)
    assert.deepEqual(body.payments[0], {
      paymentTypeId: 5,
      amount: 33320,
      recordDate: Math.floor(new Date('2026-07-06T12:00:00Z').getTime() / 1000),
    });
    // Respuesta útil para el log (urls del documento)
    assert.equal((result.response as any).urlPdf, 'https://pdf');
  });

  it('sin RUT → sin client (consumidor final); sin payment_type_id → sin payments', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 201, json: { id: 1 } }));
    const payload: ErpSalePayload = {
      ...salePayload,
      customer: { ...salePayload.customer, document: { type: null, number: null } },
      totals: { ...salePayload.totals, shipping: 0 },
    };
    await new BsaleErpAdapter(impl).notifySale(payload, ctx({ document_type_id: 8 }));
    const body = calls[0]!.body as Record<string, any>;
    assert.equal(body.client, undefined);
    assert.equal(body.payments, undefined);
    assert.equal(body.details.length, 2); // sin línea de envío
  });

  it('prices_include_tax=false manda el precio tal cual', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 201, json: { id: 1 } }));
    await new BsaleErpAdapter(impl).notifySale(
      salePayload,
      ctx({ document_type_id: 8, prices_include_tax: false })
    );
    assert.equal((calls[0]!.body as any).details[0].netUnitValue, 11900);
  });

  it('ítem sin SKU → ErpNonRetryableError', async () => {
    const { impl } = fakeFetch(() => ({ status: 201, json: { id: 1 } }));
    const payload: ErpSalePayload = {
      ...salePayload,
      items: [{ sku: null, title: 'Sin SKU', quantity: 1, unit_price: 100, total: 100 }],
    };
    await assert.rejects(
      new BsaleErpAdapter(impl).notifySale(payload, ctx({ document_type_id: 8 })),
      ErpNonRetryableError
    );
  });

  it('4xx de Bsale → ErpNonRetryableError; 5xx → ErpConnectionError (reintenta)', async () => {
    const bad = fakeFetch(() => ({ status: 422, json: { error: 'variant does not exist' } }));
    await assert.rejects(
      new BsaleErpAdapter(bad.impl).notifySale(salePayload, ctx({ document_type_id: 8 })),
      (error: Error) => error instanceof ErpNonRetryableError && /variant does not exist/.test(error.message)
    );

    const down = fakeFetch(() => ({ status: 500, json: { error: 'oops' } }));
    await assert.rejects(
      new BsaleErpAdapter(down.impl).notifySale(salePayload, ctx({ document_type_id: 8 })),
      ErpConnectionError
    );
  });
});
