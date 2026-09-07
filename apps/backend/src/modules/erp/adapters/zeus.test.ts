import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@medusajs/framework/types';
import { ZeusErpAdapter } from './zeus.ts';
import {
  ErpAuthError,
  ErpConnectionError,
  ErpNonRetryableError,
  ErpTintingFormulaNotFoundError,
  type AdapterContext,
} from './types.ts';
import type { ErpSalePayload, ErpZeusSettings } from '../types.ts';

const logger = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;

function ctx(
  zeus: ErpZeusSettings = {},
  credentials: Record<string, string> = { jwt_token: 'jwt-demo' }
): AdapterContext {
  return { credentials, settings: { zeus }, countryCode: 'AR', logger };
}

type Call = { url: URL; method: string; body: unknown; headers: Record<string, string> };

/** Fake fetch que delega en el handler y registra todas las llamadas. */
function fakeFetch(handler: (url: URL, init: RequestInit, call: Call) => { status: number; body: unknown }) {
  const calls: Call[] = [];
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

    const result = handler(url, init ?? {}, call);
    const text = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      text: async () => text,
      json: async () => JSON.parse(text),
    } as Response;
  }) as typeof globalThis.fetch;
  return { impl, calls };
}

const salePayload: ErpSalePayload = {
  event_key: 'sale_created:zeus:order_1',
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

describe('ZeusErpAdapter — validateCredentials', () => {
  // Se valida contra /empresas y NO contra /health-check/api-zeus: ese endpoint
  // responde 400 "URI is not absolute" en la cuenta real incluso con JWT válido.
  it('pega a /empresas con el Bearer JWT e informa las empresas del token', async () => {
    const { impl, calls } = fakeFetch((url) =>
      url.pathname.endsWith('/empresas')
        ? {
            status: 200,
            body: {
              status: 'OK',
              empresas: [
                { codigo_empresa: 1, descripcion_empresa: 'DESDE EL SUR SAS' },
                { codigo_empresa: 2, descripcion_empresa: 'AVM' },
              ],
            },
          }
        : { status: 404, body: '' }
    );
    const result = await new ZeusErpAdapter(impl).validateCredentials(ctx());
    assert.equal(result.ok, true);
    assert.match(result.message ?? '', /2 empresa\(s\)/);
    assert.match(result.message ?? '', /DESDE EL SUR SAS, AVM/);
    assert.equal(calls[0]!.url.pathname.endsWith('/empresas'), true);
    assert.equal(calls[0]!.headers.Authorization, 'Bearer jwt-demo');
  });

  it('acepta también la forma array pelado de /empresas', async () => {
    const { impl } = fakeFetch(() => ({
      status: 200,
      body: [{ codigo_empresa: 7, descripcion_empresa: 'UNICA' }],
    }));
    const result = await new ZeusErpAdapter(impl).validateCredentials(ctx());
    assert.equal(result.ok, true);
    assert.match(result.message ?? '', /UNICA/);
  });

  it('JWT válido sin empresas → ok:false (no sirve para operar)', async () => {
    const { impl } = fakeFetch(() => ({ status: 200, body: { status: 'OK', empresas: [] } }));
    const result = await new ZeusErpAdapter(impl).validateCredentials(ctx());
    assert.equal(result.ok, false);
    assert.match(result.message ?? '', /ninguna empresa/i);
  });

  it('401 → ok:false con mensaje de JWT; 5xx → ok:false conexión', async () => {
    const unauthorized = fakeFetch(() => ({ status: 401, body: 'invalid token' }));
    const bad = await new ZeusErpAdapter(unauthorized.impl).validateCredentials(ctx());
    assert.equal(bad.ok, false);
    assert.match(bad.message ?? '', /JWT/i);

    const down = fakeFetch(() => ({ status: 503, body: 'down' }));
    const conn = await new ZeusErpAdapter(down.impl).validateCredentials(ctx());
    assert.equal(conn.ok, false);
    assert.match(conn.message ?? '', /servidor/i);
  });

  it('sin jwt_token → mensaje claro', async () => {
    const { impl } = fakeFetch(() => ({ status: 200, body: {} }));
    const result = await new ZeusErpAdapter(impl).validateCredentials(ctx({}, {}));
    assert.equal(result.ok, false);
    assert.match(result.message ?? '', /jwt_token/);
  });
});

describe('ZeusErpAdapter — getStockBySku (pocos: getbyID)', () => {
  const rows = [
    {
      codigo: 'PROD1',
      stock: 100,
      stock_por_deposito: [
        { deposito: 1, stock: 80, comprometido: 5, acopiado: 0 },
        { deposito: 2, stock: 20, comprometido: 3, acopiado: 0 },
      ],
    },
    { codigo: 'PROD2', stock: 7, stock_por_deposito: [] },
  ];

  it('resta comprometido por default (sumando depósitos) y filtra por depósito configurado', async () => {
    const { impl, calls } = fakeFetch((url) =>
      url.pathname.endsWith('/articulos/getbyID') ? { status: 200, body: rows } : { status: 404, body: '' }
    );
    const adapter = new ZeusErpAdapter(impl);

    const total = await adapter.getStockBySku(['PROD1', 'PROD2', 'NOEXISTE'], ctx());
    // Sin comprometido a nivel raíz: suma el desglose (80-5) + (20-3) = 92
    assert.deepEqual(total.get('PROD1'), {
      found: true,
      quantity: 92,
      // El desglose viaja SIEMPRE: es lo que habilita el mapeo depósito → location.
      by_deposito: { '1': 75, '2': 17 },
    });
    // Sin desglose: cae al stock raíz
    assert.deepEqual(total.get('PROD2'), { found: true, quantity: 7, by_deposito: {} });
    assert.deepEqual(total.get('NOEXISTE'), { found: false });
    const call = calls.find((c) => c.url.pathname.endsWith('/articulos/getbyID'))!;
    assert.equal(call.url.searchParams.get('codigos_articulos'), 'PROD1,PROD2,NOEXISTE');

    const porDeposito = await adapter.getStockBySku(['PROD1'], ctx({ deposito_id: 2 }));
    // `deposito_id` acota el TOTAL, pero el desglose sigue completo: el mapeo del
    // sync es el que elige, no este setting.
    assert.deepEqual(porDeposito.get('PROD1'), {
      found: true,
      quantity: 17,
      by_deposito: { '1': 75, '2': 17 },
    });

    // Depósito configurado sin fila en el desglose → 0 (no not_found)
    const sinFila = await adapter.getStockBySku(['PROD1'], ctx({ deposito_id: 777 }));
    assert.deepEqual(sinFila.get('PROD1'), {
      found: true,
      quantity: 0,
      by_deposito: { '1': 75, '2': 17 },
    });
  });

  it('subtract_committed=false usa el stock crudo', async () => {
    const { impl } = fakeFetch((url) =>
      url.pathname.endsWith('/articulos/getbyID') ? { status: 200, body: rows } : { status: 404, body: '' }
    );
    const stock = await new ZeusErpAdapter(impl).getStockBySku(
      ['PROD1'],
      ctx({ subtract_committed: false })
    );
    assert.deepEqual(stock.get('PROD1'), {
      found: true,
      quantity: 100,
      // Sin restar comprometido, el desglose tampoco lo resta.
      by_deposito: { '1': 80, '2': 20 },
    });
  });
});

describe('ZeusErpAdapter — getStockBySku (catálogo: barrido /articulos/stock)', () => {
  it('pagina hasta la página vacía y resta comprometido', async () => {
    const manySkus = Array.from({ length: 30 }, (_, i) => `SKU-${i}`);
    const pageOf = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        codigo: `SKU-${from + i}`,
        stock: 10,
        comprometido: 4,
        stock_por_deposito: [{ deposito: 1, stock: 10, comprometido: 4 }],
      }));
    const { impl, calls } = fakeFetch((url) => {
      if (url.pathname.endsWith('/articulos/stock')) {
        assert.equal(url.searchParams.get('activo'), 'true');
        // `eshop` NO se manda nunca: la API lo ignora (ver eshop_only más abajo).
        assert.equal(url.searchParams.get('eshop'), null);
        const page = Number(url.searchParams.get('page'));
        if (page === 1) return { status: 200, body: pageOf(0, 25) };
        if (page === 2) return { status: 200, body: pageOf(25, 3) };
        return { status: 200, body: [] };
      }
      return { status: 404, body: '' };
    });

    const stock = await new ZeusErpAdapter(impl).getStockBySku(manySkus, ctx());
    const sweepCalls = calls.filter((c) => c.url.pathname.endsWith('/articulos/stock'));
    assert.equal(sweepCalls.length, 3); // 2 con datos + 1 vacía, no 30 requests
    assert.deepEqual(stock.get('SKU-0'), { found: true, quantity: 6, by_deposito: { '1': 6 } });
    assert.deepEqual(stock.get('SKU-27'), { found: true, quantity: 6, by_deposito: { '1': 6 } });
    assert.deepEqual(stock.get('SKU-29'), { found: false });
  });

  /**
   * `eshop_only` no puede resolverse con el query param `eshop` (la API lo
   * ignora) ni con /articulos/stock (no devuelve los flags de publicación), así
   * que el barrido cambia de endpoint y filtra en código.
   */
  it('eshop_only barre /articulos y filtra los no publicables en código', async () => {
    // >10 SKUs para forzar el barrido (con pocos el adapter usa getbyID).
    const manySkus = [
      'PUB',
      'NO-PUB',
      'INACTIVO',
      ...Array.from({ length: 12 }, (_, i) => `RELLENO-${i}`),
    ];
    const { impl, calls } = fakeFetch((url) => {
      if (url.pathname.endsWith('/articulos')) {
        assert.equal(url.searchParams.get('eshop'), null);
        const page = Number(url.searchParams.get('page'));
        if (page !== 1) return { status: 200, body: [] };
        return {
          status: 200,
          body: [
            { codigo: 'PUB', stock: 9, comprometido: 0, activo: 1, publica_en_ecommerce: '1' },
            { codigo: 'NO-PUB', stock: 5, comprometido: 0, activo: 1, publica_en_ecommerce: '0' },
            { codigo: 'INACTIVO', stock: 7, comprometido: 0, activo: 0, publica_en_ecommerce: '1' },
          ],
        };
      }
      return { status: 404, body: '' };
    });

    const stock = await new ZeusErpAdapter(impl).getStockBySku(manySkus, ctx({ eshop_only: true }));
    assert.equal(calls.every((c) => !c.url.pathname.endsWith('/articulos/stock')), true);
    assert.deepEqual(stock.get('PUB'), { found: true, quantity: 9, by_deposito: {} });
    assert.deepEqual(stock.get('NO-PUB'), { found: false });
    assert.deepEqual(stock.get('INACTIVO'), { found: false });
  });

  it('corta si el server ignora `page` y repite la misma página', async () => {
    const manySkus = Array.from({ length: 20 }, (_, i) => `SKU-${i}`);
    const samePage = Array.from({ length: 15 }, (_, i) => ({ codigo: `SKU-${i}`, stock: 3 }));
    const { impl, calls } = fakeFetch((url) =>
      url.pathname.endsWith('/articulos/stock') ? { status: 200, body: samePage } : { status: 404, body: '' }
    );
    const stock = await new ZeusErpAdapter(impl).getStockBySku(manySkus, ctx());
    assert.equal(calls.filter((c) => c.url.pathname.endsWith('/articulos/stock')).length, 2);
    assert.deepEqual(stock.get('SKU-0'), { found: true, quantity: 3, by_deposito: {} });
  });
});

describe('ZeusErpAdapter — notifySale', () => {
  function saleHandler(overrides: { clientFound?: boolean; pedidoStatus?: number } = {}) {
    return (url: URL, _init: RequestInit, call: Call): { status: number; body: unknown } => {
      if (url.pathname.endsWith('/clientes/search')) {
        return overrides.clientFound === false
          ? { status: 200, body: [] }
          : { status: 200, body: [{ codigo: 'CLI-945603', nombre: 'Juan Pérez', activo: true }] };
      }
      if (url.pathname.endsWith('/clientes') && call.method === 'POST') {
        return { status: 200, body: { codigo: 'CLI-NUEVO', nombre: 'Juan Pérez' } };
      }
      if (url.pathname.endsWith('/pedidos') && call.method === 'POST') {
        if (overrides.pedidoStatus && overrides.pedidoStatus !== 201) {
          return { status: overrides.pedidoStatus, body: 'conflicto' };
        }
        return { status: 201, body: [{ idtransac: 44744305, numero_comp: 24619, sucursal: 1 }] };
      }
      return { status: 404, body: '' };
    };
  }

  const saleCtx = (extra: ErpZeusSettings = {}) =>
    ctx({
      ecommerce_id: 'medusa',
      sucursal: 1,
      deposito_id: 2,
      pto_vta: 3,
      cond_venta: 'CONTADO',
      tipo_comp: 'PE',
      ...extra,
    });

  it('crea el pedido con cliente existente, id_ecommerce, netos /1.21 y settings de la cuenta', async () => {
    const { impl, calls } = fakeFetch(saleHandler());
    const result = await new ZeusErpAdapter(impl).notifySale(
      salePayload,
      saleCtx({ shipping_item_code: 'ENVIO', tipo_pago: 'MP', tarjeta_code: 'VISA' })
    );

    assert.equal(result.status, 'sent');
    assert.equal(result.external_ref, '44744305');
    assert.equal((result.response as any).numero_comp, 24619);

    const pedido = calls.find((c) => c.url.pathname.endsWith('/pedidos'))!;
    assert.equal(pedido.url.searchParams.get('ecommerce'), 'medusa');
    const body = (pedido.body as any[])[0];
    assert.equal(body.id_ecommerce, 'order_1');
    assert.equal(body.codigo_cliente, 'CLI-945603');
    assert.equal(body.numero_de_documento, '38566200');
    assert.equal(body.cuit, undefined); // DNI no va como cuit
    assert.equal(body.sucursal, 1);
    assert.equal(body.deposito, 2);
    assert.equal(body.pto_vta, 3);
    assert.equal(body.cond_venta, 'CONTADO');
    assert.equal(body.tipo_comp, 'PE');
    assert.equal(body.fecha_emitido, '2026-07-06 15:00:00');
    // 1210 / 1.21 = 1000 neto; por_iva = 21
    assert.deepEqual(body.items[0], {
      linea: 1,
      codigo: 'PROD1',
      descripcion: 'Producto uno',
      cantidad: 2,
      precio: 1000,
      dto_linea: 0,
      por_iva: 21,
      total: 2000,
    });
    // Envío como artículo configurado: 121 / 1.21 = 100
    assert.equal(body.items[2].codigo, 'ENVIO');
    assert.equal(body.items[2].precio, 100);
    // Totales: neto = 3146/1.21 = 2600, iva = 546
    assert.equal(body.neto_gravado, 2600);
    assert.equal(body.iva, 546);
    assert.equal(body.total, 3146);
    // Pago informado con el tipo mapeado
    assert.deepEqual(body.medios_pago, [
      { tipo_pago: 'MP', importe: 3146, codigo_tarjeta: 'VISA', comentario: 'Venta web #456' },
    ]);
  });

  it('409 del pedido → duplicate (idempotencia por id_ecommerce)', async () => {
    const { impl } = fakeFetch(saleHandler({ pedidoStatus: 409 }));
    const result = await new ZeusErpAdapter(impl).notifySale(salePayload, saleCtx());
    assert.equal(result.status, 'duplicate');
  });

  it('cliente inexistente → lo crea y usa el código devuelto', async () => {
    const { impl, calls } = fakeFetch(saleHandler({ clientFound: false }));
    await new ZeusErpAdapter(impl).notifySale(salePayload, saleCtx({ default_codigo_iva: 5 }));
    const create = calls.find((c) => c.url.pathname.endsWith('/clientes') && c.method === 'POST')!;
    const body = create.body as Record<string, any>;
    assert.equal(body.razon_social, 'Juan Pérez');
    assert.equal(body.dni_cuit, 38566200);
    assert.equal(body.codigo_iva, 5);
    // DNI busca por numero_de_documento (no cuit) y luego cae a email
    const searches = calls.filter((c) => c.url.pathname.endsWith('/clientes/search'));
    assert.equal(searches[0]!.url.searchParams.get('numero_de_documento'), '38566200');
    assert.equal(searches[1]!.url.searchParams.get('email'), 'juan@test.com.ar');
    const pedido = calls.find((c) => c.url.pathname.endsWith('/pedidos'))!;
    assert.equal((pedido.body as any[])[0].codigo_cliente, 'CLI-NUEVO');
  });

  it('CUIT busca por cuit y viaja como número en el comprobante', async () => {
    const cuitPayload: ErpSalePayload = {
      ...salePayload,
      customer: { ...salePayload.customer, document: { type: 'CUIT', number: '30-70895184-2' } },
    };
    const { impl, calls } = fakeFetch(saleHandler());
    await new ZeusErpAdapter(impl).notifySale(cuitPayload, saleCtx());
    const search = calls.find((c) => c.url.pathname.endsWith('/clientes/search'))!;
    assert.equal(search.url.searchParams.get('cuit'), '30708951842');
    const body = (calls.find((c) => c.url.pathname.endsWith('/pedidos'))!.body as any[])[0];
    assert.equal(body.cuit, 30708951842);
  });

  it('sin documento y sin default_client_code → ErpNonRetryableError; con default lo usa', async () => {
    const anon: ErpSalePayload = {
      ...salePayload,
      customer: { ...salePayload.customer, document: { type: null, number: null } },
    };
    const { impl, calls } = fakeFetch(saleHandler());
    const adapter = new ZeusErpAdapter(impl);
    await assert.rejects(adapter.notifySale(anon, saleCtx()), ErpNonRetryableError);

    await adapter.notifySale(anon, saleCtx({ default_client_code: 'CF-000' }));
    const pedido = calls.find((c) => c.url.pathname.endsWith('/pedidos'))!;
    const body = (pedido.body as any[])[0];
    assert.equal(body.codigo_cliente, 'CF-000');
    // Sin artículo de envío configurado, el costo va en observaciones.
    assert.match(body.observaciones1, /Envío: \$121/);
    // Sin tipo_pago configurado no se informan pagos.
    assert.equal(body.medios_pago, undefined);
  });

  it('ítems sin SKU → ErpNonRetryableError', async () => {
    const badPayload: ErpSalePayload = {
      ...salePayload,
      items: [{ sku: null, title: 'Sin código', quantity: 1, unit_price: 100, total: 100 }],
    };
    const { impl } = fakeFetch(saleHandler());
    await assert.rejects(
      new ZeusErpAdapter(impl).notifySale(badPayload, saleCtx()),
      (error: Error) => error instanceof ErpNonRetryableError && /Sin código/.test(error.message)
    );
  });

  it('respuesta sin idtransac → ErpConnectionError (reintenta)', async () => {
    const { impl } = fakeFetch((url, init, call) => {
      if (url.pathname.endsWith('/pedidos') && call.method === 'POST') return { status: 201, body: [{}] };
      return saleHandler()(url, init, call);
    });
    await assert.rejects(new ZeusErpAdapter(impl).notifySale(salePayload, saleCtx()), ErpConnectionError);
  });

  it('401 → ErpAuthError; 5xx → ErpConnectionError; 400 → ErpNonRetryableError', async () => {
    for (const [status, errorType] of [
      [401, ErpAuthError],
      [500, ErpConnectionError],
      [400, ErpNonRetryableError],
    ] as const) {
      const { impl } = fakeFetch(() => ({ status, body: 'nope' }));
      await assert.rejects(new ZeusErpAdapter(impl).notifySale(salePayload, saleCtx()), errorType);
    }
  });
});

describe('ZeusErpAdapter — notifySale con alícuotas mixtas', () => {
  /**
   * El catálogo real NO es uniforme (3428 artículos al 21% y 10 al 10.5%), así
   * que la tasa se toma por línea desde `item.tax_rate` (que el catalog sync
   * dejó en `variant.metadata.zeus_por_iva`) y solo se cae al global si falta.
   */
  it('usa tax_rate por línea y arma el neto como suma de líneas', async () => {
    const mixed: ErpSalePayload = {
      ...salePayload,
      items: [
        // 21%: 1210 / 1.21 = 1000
        { sku: 'IVA21', title: 'Al 21', quantity: 1, unit_price: 1210, total: 1210, tax_rate: 21 },
        // 10.5%: 1105 / 1.105 = 1000
        { sku: 'IVA105', title: 'Al 10.5', quantity: 2, unit_price: 1105, total: 2210, tax_rate: 10.5 },
        // sin dato → cae al global (21%): 605 / 1.21 = 500
        { sku: 'SINDATO', title: 'Sin dato', quantity: 1, unit_price: 605, total: 605, tax_rate: null },
      ],
      totals: { subtotal: 4025, discount: 0, shipping: 0, tax: 0, total: 4025 },
    };

    const { impl, calls } = fakeFetch((url, _init, call) => {
      if (url.pathname.endsWith('/clientes/search')) {
        return { status: 200, body: [{ codigo: 'CLI-1', activo: true }] };
      }
      if (url.pathname.endsWith('/pedidos') && call.method === 'POST') {
        return { status: 201, body: [{ idtransac: 1, numero_comp: 1, sucursal: 1 }] };
      }
      return { status: 404, body: '' };
    });

    await new ZeusErpAdapter(impl).notifySale(mixed, ctx({ sucursal: 1 }));
    const body = (calls.find((c) => c.url.pathname.endsWith('/pedidos'))!.body as any[])[0];

    assert.equal(body.items[0].precio, 1000);
    assert.equal(body.items[0].por_iva, 21);
    assert.equal(body.items[1].precio, 1000);
    assert.equal(body.items[1].por_iva, 10.5); // NO 21: usa la del artículo
    assert.equal(body.items[1].total, 2000);
    assert.equal(body.items[2].por_iva, 21); // fallback global

    // Neto = 1000 + 2000 + 500 = 3500 (suma de líneas, no total/1.21 = 3326.45)
    assert.equal(body.neto_gravado, 3500);
    assert.equal(body.iva, 525);
    assert.equal(body.total, 4025);
  });
});

describe('ZeusErpAdapter — getCatalogChanges', () => {
  const articulo = (over: Record<string, unknown> = {}) => ({
    codigo: '010/50',
    descripcion: 'EQ ARTE - ACRILICO G2 010 PLATEADO X 50 CC',
    descripcion_ampliada: 'Acrílico de 50cc',
    precio0: 0,
    precio1: 2526.12,
    precio2: 2526.12,
    precio4: 1768.28,
    por_iva: 21,
    activo: 1,
    publica_en_ecommerce: '1',
    categoria: '020b',
    marca: 'EQ ARTE',
    familia: 'ARTISTICA ACRILICOS',
    codigo_fabrica: '1.1.1.50.010',
    peso: 0.08,
    alto: 5,
    ancho: 4,
    largo: 3,
    fechahoramodife: '2026-05-16 10:53:43.723',
    ...over,
  });

  it('mapea el ArticulosDto a la fila neutral y normaliza los flags string', async () => {
    const { impl, calls } = fakeFetch((url) =>
      url.pathname.endsWith('/articulos') ? { status: 200, body: [articulo()] } : { status: 404, body: '' }
    );
    const rows = await new ZeusErpAdapter(impl).getCatalogChanges!(null, ctx());

    assert.equal(rows.length, 1);
    const row = rows[0]!;
    assert.equal(row.code, '010/50');
    assert.equal(row.prices[1], 2526.12);
    assert.equal(row.prices[4], 1768.28);
    // 0 en Zeus = "la lista no aplica", no "gratis"
    assert.equal(row.prices[0], null);
    assert.equal(row.prices[9], null);
    assert.equal(row.tax_rate, 21);
    assert.equal(row.published, true); // "1" string
    assert.equal(row.active, true);
    assert.equal(row.category_code, '020B'); // normalizado a mayúsculas
    assert.equal(row.brand, 'EQ ARTE');
    // El fixture no trae `notas2`, así que no hay barcode. `codigo_fabrica` es una
    // referencia de fabrica y NO puede terminar en `barcode` (lo lee el escaner).
    assert.equal(row.barcode, null);
    assert.equal(row.barcode_rejected, undefined);
    assert.equal(row.factory_code, '1.1.1.50.010');
    assert.equal(row.weight, 0.08);
    assert.equal(row.modified_at, '2026-05-16 10:53:43.723');
    assert.equal(row.description, 'Acrílico de 50cc');

    // Catálogo completo: page=0 (el server lo devuelve entero) y sin fechasincro
    const call = calls.find((c) => c.url.pathname.endsWith('/articulos'))!;
    assert.equal(call.url.searchParams.get('page'), '0');
    assert.equal(call.url.searchParams.get('fechasincro'), null);
  });

  it('toma el código de barras de `notas2`, validado como GTIN', async () => {
    // Zeus no tiene campo propio de barcode; el cliente definió usar `notas2`, que
    // es una NOTA de texto libre. Se valida antes de escribir porque el destino es
    // el campo que lee el escáner del checkout.
    const { impl } = fakeFetch((url) =>
      url.pathname.endsWith('/articulos')
        ? {
            status: 200,
            body: [
              articulo({ notas2: '7790040000100' }),
              articulo({ codigo: '11', notas2: ' 779-0040-000100 ' }),
              articulo({ codigo: '12', notas2: 'consultar con deposito' }),
              articulo({ codigo: '13', notas2: '12345' }),
              articulo({ codigo: '14', notas2: '7790040000108' }),
              articulo({ codigo: '15', notas2: '' }),
            ],
          }
        : { status: 404, body: '' }
    );
    const rows = await new ZeusErpAdapter(impl).getCatalogChanges!(null, ctx());

    assert.equal(rows[0]!.barcode, '7790040000100');
    // Los separadores con los que se carga a mano no invalidan el código.
    assert.equal(rows[1]!.barcode, '7790040000100');

    // Texto libre, largo inválido y dígito verificador incorrecto se descartan CON
    // motivo, en lugar de ensuciar el barcode.
    for (const index of [2, 3, 4]) {
      assert.equal(rows[index]!.barcode, null);
      assert.ok(rows[index]!.barcode_rejected, `la fila ${index} tiene que explicar el rechazo`);
    }
    assert.match(rows[2]!.barcode_rejected!, /no numéricos/);
    assert.match(rows[3]!.barcode_rejected!, /5 dígitos/);
    assert.match(rows[4]!.barcode_rejected!, /dígito verificador/);

    // Vacío no es rechazo: es la mayoría del catálogo y no debe generar warning.
    assert.equal(rows[5]!.barcode, null);
    assert.equal(rows[5]!.barcode_rejected, undefined);
  });

  it('no usa como descripción el código de fabricante de `descripcion_adicional`', async () => {
    // Caso real: las 117 bases entonables no tienen `descripcion_ampliada` y su
    // `descripcion_adicional` es el código del fabricante, así que el PDP mostraba
    // "12406" como descripción del producto.
    const { impl } = fakeFetch((url) =>
      url.pathname.endsWith('/articulos')
        ? {
            status: 200,
            body: [
              articulo({ descripcion_ampliada: null, descripcion_adicional: '12406' }),
              articulo({
                codigo: '188',
                descripcion_ampliada: '',
                descripcion_adicional: '15345   ex 5275536',
              }),
              articulo({
                codigo: '999',
                descripcion_ampliada: null,
                descripcion_adicional: 'Base para entonar con el sistema tintométrico.',
              }),
              // Borde a propósito: sin una palabra de 3+ letras es una medida o un
              // código, no una descripción (el tamaño ya viaja en el título).
              articulo({ codigo: '888', descripcion_ampliada: null, descripcion_adicional: '500 ml' }),
            ],
          }
        : { status: 404, body: '' }
    );
    const rows = await new ZeusErpAdapter(impl).getCatalogChanges!(null, ctx());

    assert.equal(rows[0]!.description, null); // código pelado
    assert.equal(rows[1]!.description, null); // "N ex N": "ex" no alcanza como palabra
    // Texto de verdad: pasa tal cual, no se recorta nada.
    assert.equal(rows[2]!.description, 'Base para entonar con el sistema tintométrico.');
    assert.equal(rows[3]!.description, null); // "500 ml"
  });

  it('con `since` manda fechasincro sin reinterpretar la hora local de Zeus', async () => {
    const { impl, calls } = fakeFetch((url) =>
      url.pathname.endsWith('/articulos') ? { status: 200, body: [] } : { status: 404, body: '' }
    );
    await new ZeusErpAdapter(impl).getCatalogChanges!('2026-07-23 10:15:05.660', ctx());
    const call = calls.find((c) => c.url.pathname.endsWith('/articulos'))!;
    // Se recorta a segundos pero NO se convierte a UTC: los timestamps de Zeus
    // son hora local naive y convertirlos correría el watermark 3 horas.
    assert.equal(call.url.searchParams.get('fechasincro'), '2026-07-23 10:15:05');
  });

  it('descarta filas sin código y marca no publicables sin filtrarlas', async () => {
    const { impl } = fakeFetch((url) =>
      url.pathname.endsWith('/articulos')
        ? {
            status: 200,
            body: [
              articulo(),
              articulo({ codigo: '  ' }),
              articulo({ codigo: 'X1', publica_en_ecommerce: '0', activo: 0 }),
            ],
          }
        : { status: 404, body: '' }
    );
    const rows = await new ZeusErpAdapter(impl).getCatalogChanges!(null, ctx());
    // La fila sin código se descarta; el filtro de publicables es del motor, no
    // del adapter, así que X1 sí viene (con published/active en false).
    assert.deepEqual(rows.map((r) => r.code), ['010/50', 'X1']);
    assert.equal(rows[1]!.published, false);
    assert.equal(rows[1]!.active, false);
  });

  it('declara la capability y que los precios ya vienen con IVA', () => {
    const caps = new ZeusErpAdapter().getCapabilities();
    assert.equal(caps.catalog_pull, true);
    assert.equal(caps.catalog_prices_include_tax, true);
    assert.equal(caps.categories_pull, true);
    assert.equal(caps.tinting_price, true);
  });
});

/**
 * Golden fixture MEDIDO contra la cuenta real (2026-07-29): fórmula
 * `00NN 16/000` (color COSMOS) sobre la base `113` (ALBACRYL BASE F 3,6 L).
 * Ver el detalle de la semántica en la cabecera de zeus.ts.
 */
const COSMOS_RESPONSE = {
  codigoformulaho: '00NN 16/000',
  codigobase: '113',
  total: 66352.822,
  ival: 0,
  poriva: 21.0,
};

describe('ZeusErpAdapter — notifySale con línea entonada', () => {
  it('manda codigo_base + codigo_formula sólo en la línea entonada', async () => {
    const { impl, calls } = fakeFetch((url) => {
      if (url.pathname.endsWith('/clientes/search')) {
        return { status: 200, body: { clientes: [{ codigo: 'CLI1', nombre: 'Juan', activo: true }] } };
      }
      return { status: 201, body: [{ idtransac: 1, numero_comp: 1, sucursal: 1 }] };
    });

    await new ZeusErpAdapter(impl).notifySale(
      {
        ...salePayload,
        items: [
          {
            sku: '113',
            title: 'ALBACRYL LATEX INTERIOR ACRILICO MATE BASE F X 3,6 LTS',
            quantity: 1,
            unit_price: 66352.82,
            total: 66352.82,
            tax_rate: 21,
            tint: {
              cod_base: '113',
              cod_formula: '00NN 16/000',
              color_code: 'COSMOS',
              color_name: 'Cosmos',
            },
          },
          { sku: 'PROD2', title: 'Producto dos', quantity: 1, unit_price: 605, total: 605 },
        ],
      },
      ctx({ create_clients: false, default_client_code: 'CLI1' })
    );

    const pedido = calls.find((c) => c.url.pathname.endsWith('/pedidos'))!;
    const items = (pedido.body as Array<{ items: Array<Record<string, unknown>> }>)[0]!.items;

    // El artículo sigue siendo la BASE: es lo que Zeus tiene en el maestro.
    assert.equal(items[0]!.codigo, '113');
    assert.equal(items[0]!.codigo_base, '113');
    // El código de fórmula viaja como lo muestra Gestión (con espacio).
    assert.equal(items[0]!.codigo_formula, '00NN 16/000');
    // El color también en la descripción, por si Zeus ignora los campos nuevos.
    assert.match(String(items[0]!.descripcion), /Color Cosmos/);

    // La línea normal queda idéntica a lo de siempre: ninguna clave nueva.
    assert.ok(!('codigo_base' in items[1]!));
    assert.ok(!('codigo_formula' in items[1]!));
    assert.equal(items[1]!.descripcion, 'Producto dos');
  });
});

describe('ZeusErpAdapter.getTintingPrice', () => {
  const query = { base_code: '113', formula_code: '00NN 16/000', list_index: 1, quantity: 1 };

  it('cotiza contra formulaTintometrico y devuelve el DTO crudo', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, body: COSMOS_RESPONSE }));
    const raw = await new ZeusErpAdapter(impl).getTintingPrice!(query, ctx());

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url.pathname, '/api-ecommerce/articulos/formulaTintometrico');
    assert.deepEqual(raw, {
      base_code: '113',
      formula_code: '00NN 16/000',
      total: 66352.822,
      tax_rate: 21,
    });
  });

  it('manda el codFormula SIN espacios (con espacios el ERP responde "no existe")', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, body: COSMOS_RESPONSE }));
    await new ZeusErpAdapter(impl).getTintingPrice!(query, ctx());
    assert.equal(calls[0]!.url.searchParams.get('codFormula'), '00NN16/000');
    assert.equal(calls[0]!.url.searchParams.get('codBase'), '113');
  });

  it('serializa lista y cantidad como enteros pelados (la API rechaza "1.0")', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, body: COSMOS_RESPONSE }));
    await new ZeusErpAdapter(impl).getTintingPrice!({ ...query, list_index: 4, quantity: 2 }, ctx());
    assert.equal(calls[0]!.url.searchParams.get('lista'), '4');
    assert.equal(calls[0]!.url.searchParams.get('cantidad'), '2');
  });

  it('no gasta la llamada si la cantidad no es un entero ≥ 1', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, body: COSMOS_RESPONSE }));
    const adapter = new ZeusErpAdapter(impl);
    await assert.rejects(
      () => adapter.getTintingPrice!({ ...query, quantity: 1.5 }, ctx()),
      ErpNonRetryableError
    );
    await assert.rejects(
      () => adapter.getTintingPrice!({ ...query, quantity: 0 }, ctx()),
      ErpNonRetryableError
    );
    await assert.rejects(
      () => adapter.getTintingPrice!({ ...query, formula_code: '   ' }, ctx()),
      ErpNonRetryableError
    );
    assert.equal(calls.length, 0);
  });

  it('el 409 de fórmula inexistente es su propio error, y sigue siendo no reintentable', async () => {
    // Respuesta textual del ERP.
    const { impl } = fakeFetch(() => ({
      status: 409,
      body: {
        status: 'CONFLICT',
        errors: [{ code: 0, details: null, message: 'La fórmula 00NN 16/000 no existe en Zeus Gestión.', status: null }],
      },
    }));
    await assert.rejects(
      () => new ZeusErpAdapter(impl).getTintingPrice!(query, ctx()),
      (error: unknown) => {
        assert.ok(error instanceof ErpTintingFormulaNotFoundError);
        assert.ok(error instanceof ErpNonRetryableError);
        assert.equal(error.formulaCode, '00NN 16/000');
        assert.equal(error.baseCode, '113');
        return true;
      }
    );
  });

  it('mapea 400 / 401 / 500 a la taxonomía del módulo', async () => {
    const cases: Array<[number, unknown, new () => Error]> = [
      [400, { errors: [{ message: 'Falta el parámetro: codBase' }] }, ErpNonRetryableError],
      [401, '', ErpAuthError],
      [500, '', ErpConnectionError],
    ];
    for (const [status, body, ErrorClass] of cases) {
      const { impl } = fakeFetch(() => ({ status, body }));
      await assert.rejects(() => new ZeusErpAdapter(impl).getTintingPrice!(query, ctx()), ErrorClass);
    }
  });

  it('un 200 sin total no se toma como precio 0', async () => {
    const { impl } = fakeFetch(() => ({ status: 200, body: { codigobase: '113' } }));
    await assert.rejects(
      () => new ZeusErpAdapter(impl).getTintingPrice!(query, ctx()),
      ErpNonRetryableError
    );
  });

  it('devuelve el total 0.0 de una lista sin precio: lo descarta el normalizador, no el adapter', async () => {
    const { impl } = fakeFetch(() => ({ status: 200, body: { ...COSMOS_RESPONSE, total: 0.0 } }));
    const raw = await new ZeusErpAdapter(impl).getTintingPrice!({ ...query, list_index: 5 }, ctx());
    assert.equal(raw.total, 0);
  });
});

describe('ZeusErpAdapter.fetchCategories', () => {
  /** Árbol de muestra con la forma real: 3 niveles y códigos hex-ish (…09 → 0A). */
  const tree = [
    {
      id: '01',
      nombre: 'ACCESORIOS',
      foto: 'https://cdn/01.jpg',
      categorias_hijas: [
        {
          id: '0101',
          nombre: 'ABRASIVOS',
          categorias_hijas: [{ id: '010101', nombre: 'LIJA AL AGUA', categorias_hijas: [] }],
        },
        { id: '010A', nombre: 'LLANAS', categorias_hijas: null },
      ],
    },
    { id: '02', nombre: 'PINTURA', categorias_hijas: [{ id: '020b', nombre: 'ARTISTICA' }] },
  ];

  const categoriesFetch = (body: unknown, status = 200) =>
    fakeFetch((url) =>
      url.pathname.endsWith('/articulos/categorias') ? { status, body } : { status: 404, body: '' }
    );

  it('aplana el árbol con padres antes que hijos, con rank y nivel', async () => {
    const { impl, calls } = categoriesFetch(tree);
    const nodes = await new ZeusErpAdapter(impl).fetchCategories!(ctx());

    assert.deepEqual(
      nodes.map((n) => [n.code, n.parent_code, n.level, n.rank]),
      [
        ['01', null, 0, 0],
        ['0101', '01', 1, 0],
        ['010101', '0101', 2, 0],
        ['010A', '01', 1, 1],
        ['02', null, 0, 1],
        ['020B', '02', 1, 0],
      ]
    );
    assert.equal(nodes[0]!.name, 'ACCESORIOS');
    assert.equal(nodes[0]!.image_url, 'https://cdn/01.jpg');
    // Sin `foto` el campo queda null, no undefined ni ''.
    assert.equal(nodes[1]!.image_url, null);

    const call = calls[0]!;
    assert.equal(call.url.pathname, '/api-ecommerce/articulos/categorias');
    assert.equal(call.headers.Authorization, 'Bearer jwt-demo');
  });

  it('normaliza los códigos a mayúsculas para que matcheen los del artículo', async () => {
    const { impl } = categoriesFetch([{ id: '0a', nombre: 'COMPLEMENTOS' }]);
    const nodes = await new ZeusErpAdapter(impl).fetchCategories!(ctx());
    assert.equal(nodes[0]!.code, '0A');
  });

  it('acepta la respuesta envuelta en `categorias`', async () => {
    const { impl } = categoriesFetch({ categorias: [{ id: '03', nombre: 'TEXTURADOS' }] });
    const nodes = await new ZeusErpAdapter(impl).fetchCategories!(ctx());
    assert.deepEqual(nodes.map((n) => n.code), ['03']);
  });

  it('saltea nodos sin código o sin nombre sin perder a los hermanos', async () => {
    const { impl } = categoriesFetch([
      { id: '  ', nombre: 'SIN CODIGO' },
      { id: '04', nombre: '   ' },
      { id: '05', nombre: 'PISOS' },
    ]);
    const nodes = await new ZeusErpAdapter(impl).fetchCategories!(ctx());
    assert.deepEqual(nodes.map((n) => n.code), ['05']);
    // El rank es el del ERP tal cual viene: los salteados igual consumen posición
    // solo si son válidos, así que PISOS queda en 0.
    assert.equal(nodes[0]!.rank, 0);
  });

  it('se queda con la primera aparición de un código duplicado', async () => {
    const { impl } = categoriesFetch([
      { id: '06', nombre: 'MASILLAS' },
      { id: '06', nombre: 'MASILLAS BIS' },
    ]);
    const nodes = await new ZeusErpAdapter(impl).fetchCategories!(ctx());
    assert.deepEqual(nodes.map((n) => n.name), ['MASILLAS']);
  });

  it('respuesta vacía o inesperada devuelve lista vacía', async () => {
    for (const body of [[], {}, null]) {
      const { impl } = categoriesFetch(body);
      assert.deepEqual(await new ZeusErpAdapter(impl).fetchCategories!(ctx()), []);
    }
  });

  it('mapea los errores del ERP a la taxonomía del módulo', async () => {
    const cases: Array<[number, unknown]> = [
      [401, ErpAuthError],
      [500, ErpConnectionError],
      [422, ErpNonRetryableError],
    ];
    for (const [status, ErrorClass] of cases) {
      const { impl } = categoriesFetch({ message: 'nope' }, status);
      await assert.rejects(
        () => new ZeusErpAdapter(impl).fetchCategories!(ctx()),
        ErrorClass as new () => Error
      );
    }
  });
});
