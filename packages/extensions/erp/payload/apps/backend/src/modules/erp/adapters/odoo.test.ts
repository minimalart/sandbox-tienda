import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@medusajs/framework/types';
import { OdooErpAdapter } from './odoo.ts';
import { OdooRpcClient, type OdooRpcConfig } from './odoo-rpc-client.ts';
import { ErpAuthError, ErpNonRetryableError, type AdapterContext } from './types.ts';
import type { ErpOdooSettings, ErpSalePayload } from '../types.ts';

const logger = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;

const DEFAULT_SETTINGS: ErpOdooSettings = {
  base_url: 'http://localhost:8069',
  db: 'mercatto-dev',
  uid: 2,
  api_key: 'ignored-here',
};

function ctx(
  odoo: ErpOdooSettings = DEFAULT_SETTINGS,
  credentials: Record<string, string> = { api_key: 'demo-key' }
): AdapterContext {
  return { credentials, settings: { odoo }, countryCode: 'AR', logger };
}

/**
 * Reemplazo del `OdooRpcClient` real por un handler tabular: cada spec compone
 * el mapa `(model.method) → resultado` o pasa un handler que decide por args.
 * Se registran todas las llamadas para poder inspeccionar el domain, los kwargs
 * y el orden de invocación.
 */
type CallRecord = {
  model: string;
  method: string;
  args: unknown[];
  kwargs: Record<string, unknown>;
};

/**
 * Devuelve la N-ésima llamada `search_read` sobre `product.template` — el catalog
 * pull hace un `fields_get` de sonda antes del `search_read` (para detectar
 * campos opcionales tipo `description_ecommerce`), así que `calls[0]` ya no es
 * el search del catálogo. Este helper aísla ese detalle de los tests.
 */
function catalogSearchCall(calls: CallRecord[], nth = 0): CallRecord | undefined {
  const searches = calls.filter(
    (c) => c.model === 'product.template' && c.method === 'search_read'
  );
  return searches[nth];
}

function fakeClient(
  handler: (call: CallRecord) => unknown
): {
  factory: (config: OdooRpcConfig) => OdooRpcClient;
  calls: CallRecord[];
  configs: OdooRpcConfig[];
} {
  const calls: CallRecord[] = [];
  const configs: OdooRpcConfig[] = [];
  const factory = (config: OdooRpcConfig): OdooRpcClient => {
    configs.push(config);
    return {
      executeKw: async (model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) => {
        const call: CallRecord = { model, method, args, kwargs };
        calls.push(call);
        const result = handler(call);
        if (result instanceof Error) throw result;
        return result;
      },
    } as unknown as OdooRpcClient;
  };
  return { factory, calls, configs };
}

describe('OdooErpAdapter — getCapabilities', () => {
  it('shape v1: stock/sale/catalog/categories/images en true; invoice/tinting en false', () => {
    const capabilities = new OdooErpAdapter().getCapabilities();
    assert.deepEqual(capabilities, {
      stock_pull: true,
      sale_notify: true,
      stock_batch_size: 100_000,
      catalog_pull: true,
      catalog_prices_include_tax: false,
      categories_pull: true,
      tinting_price: false,
      product_images: true,
      invoice_fetch: false,
      config_lookups: false,
    });
  });
});

describe('OdooErpAdapter — validateCredentials', () => {
  it('lee res.users con el uid del context y devuelve name + login', async () => {
    const { factory, calls } = fakeClient(({ model, method }) => {
      if (model === 'res.users' && method === 'read') {
        return [{ id: 2, login: 'admin', name: 'Administrator' }];
      }
      return null;
    });
    const result = await new OdooErpAdapter(factory).validateCredentials(ctx());
    assert.equal(result.ok, true);
    assert.match(result.message ?? '', /Administrator/);
    assert.match(result.message ?? '', /admin/);
    assert.equal(calls[0]?.model, 'res.users');
    assert.equal(calls[0]?.method, 'read');
    // args = [[uid], ['login','name']]
    assert.deepEqual(calls[0]?.args, [[2], ['login', 'name']]);
  });

  it('AccessError del cliente → ok:false con el mensaje traducido', async () => {
    const { factory } = fakeClient(() => new ErpAuthError('Odoo: Invalid API key.'));
    const result = await new OdooErpAdapter(factory).validateCredentials(ctx());
    assert.equal(result.ok, false);
    assert.match(result.message ?? '', /Invalid API key/);
  });

  it('sin api_key → ok:false con mensaje de credencial', async () => {
    const { factory } = fakeClient(() => []);
    const result = await new OdooErpAdapter(factory).validateCredentials(ctx(DEFAULT_SETTINGS, {}));
    assert.equal(result.ok, false);
    assert.match(result.message ?? '', /api_key/i);
  });

  it('res.users vacío → ok:false con el uid impreso', async () => {
    const { factory } = fakeClient(() => []);
    const result = await new OdooErpAdapter(factory).validateCredentials(ctx());
    assert.equal(result.ok, false);
    assert.match(result.message ?? '', /uid 2/);
  });
});

describe('OdooErpAdapter — getStockBySku (pocos: default_code IN)', () => {
  it('emite un solo search_read con domain "in" y devuelve found:true con free_qty', async () => {
    const { factory, calls } = fakeClient(({ model, method }) => {
      if (model === 'product.product' && method === 'search_read') {
        return [
          { id: 27, default_code: 'E-COM11', free_qty: 33, qty_available: 33 },
          { id: 28, default_code: 'E-COM12', free_qty: 12.7, qty_available: 15 },
        ];
      }
      return null;
    });
    const result = await new OdooErpAdapter(factory).getStockBySku(
      ['E-COM11', 'E-COM12', 'MISSING'],
      ctx()
    );
    assert.equal(calls.length, 1);
    // Domain esperado en args[0]:
    assert.deepEqual(calls[0]?.args, [[['default_code', 'in', ['E-COM11', 'E-COM12', 'MISSING']]]]);
    assert.deepEqual(result.get('E-COM11'), { found: true, quantity: 33 });
    // Fraccional → piso (12)
    assert.deepEqual(result.get('E-COM12'), { found: true, quantity: 12 });
    assert.deepEqual(result.get('MISSING'), { found: false });
  });

  it('free_qty negativo → 0 (mismo criterio que Zeus para stock reservado > físico)', async () => {
    const { factory } = fakeClient(() => [
      { id: 99, default_code: 'NEG', free_qty: -5, qty_available: 0 },
    ]);
    const result = await new OdooErpAdapter(factory).getStockBySku(['NEG'], ctx());
    assert.deepEqual(result.get('NEG'), { found: true, quantity: 0 });
  });

  it('filas con default_code: false se ignoran (Odoo devuelve `false` en vez de null)', async () => {
    const { factory } = fakeClient(() => [
      { id: 1, default_code: false, free_qty: 999, qty_available: 999 },
      { id: 2, default_code: 'REAL', free_qty: 4, qty_available: 4 },
    ]);
    const result = await new OdooErpAdapter(factory).getStockBySku(['REAL', 'GHOST'], ctx());
    assert.deepEqual(result.get('REAL'), { found: true, quantity: 4 });
    assert.deepEqual(result.get('GHOST'), { found: false });
  });
});

describe('OdooErpAdapter — getStockBySku (sweep: > 10 SKUs)', () => {
  it('barre paginado por 200 y agrega resultados', async () => {
    // 11 SKUs → dispara el sweep.
    const requested = Array.from({ length: 11 }, (_, i) => `SKU-${i}`);
    // Simulamos 2 páginas: la primera con 200 productos (pero devolvemos solo
    // 200 pseudo-filas para que se vuelva a pedir la siguiente), la segunda con
    // 3 y ya corta.
    const { factory, calls } = fakeClient(({ model, method, kwargs }) => {
      if (model !== 'product.product' || method !== 'search_read') return null;
      const offset = Number(kwargs.offset ?? 0);
      if (offset === 0) {
        return Array.from({ length: 200 }, (_, i) => ({
          id: i + 1,
          default_code: `SKU-${i}`,
          free_qty: i,
          qty_available: i,
        }));
      }
      if (offset === 200) {
        return [
          { id: 201, default_code: 'SKU-200', free_qty: 5, qty_available: 5 },
          { id: 202, default_code: 'SKU-201', free_qty: 6, qty_available: 6 },
          { id: 203, default_code: 'SKU-202', free_qty: 7, qty_available: 7 },
        ];
      }
      return [];
    });
    const result = await new OdooErpAdapter(factory).getStockBySku(requested, ctx());
    // Se hicieron dos requests de sweep (la segunda ya devuelve < page_size y corta).
    assert.equal(calls.length, 2);
    // Domain del sweep: default_code != false
    assert.deepEqual(calls[0]?.args, [[['default_code', '!=', false]]]);
    // kwargs con paginación y orden estable
    assert.equal(calls[0]?.kwargs.limit, 200);
    assert.equal(calls[0]?.kwargs.offset, 0);
    assert.equal(calls[0]?.kwargs.order, 'id asc');
    assert.equal(calls[1]?.kwargs.offset, 200);
    // Solo se piden 11 SKUs, no todos los que trajo el sweep.
    assert.deepEqual(result.get('SKU-0'), { found: true, quantity: 0 });
    assert.deepEqual(result.get('SKU-10'), { found: true, quantity: 10 });
    // Los 11 respondidos tienen entrada:
    assert.equal(result.size, requested.length);
  });
});

describe('OdooErpAdapter — getCatalogChanges', () => {
  it('sin `since` → domain vacío; con `since` → filtro write_date >', async () => {
    const { factory, calls } = fakeClient(({ model, method }) => {
      if (model === 'product.template' && method === 'search_read') {
        return [
          {
            id: 10,
            default_code: 'P-1',
            name: 'Producto uno',
            list_price: 1000,
            categ_id: [1, 'All / Saleable'] as [number, string],
            image_1920: 'iVBORw0KGgo=',
            write_date: '2026-08-30 12:00:00',
            active: true,
            sale_ok: true,
            type: 'product',
          },
        ];
      }
      return [];
    });
    const adapter = new OdooErpAdapter(factory);

    const full = await adapter.getCatalogChanges(null, ctx());
    assert.deepEqual(catalogSearchCall(calls, 0)?.args, [[]]);
    assert.equal(full.length, 1);
    assert.equal(full[0]?.code, 'P-1');
    assert.equal(full[0]?.title, 'Producto uno');
    assert.deepEqual(full[0]?.prices, { 0: 1000 });
    assert.equal(full[0]?.category_code, 'ODOO:1');
    assert.equal(full[0]?.active, true);
    assert.equal(full[0]?.published, true);
    assert.equal(full[0]?.modified_at, '2026-08-30 12:00:00');

    const delta = await adapter.getCatalogChanges('2026-08-01 00:00:00', ctx());
    // La segunda `search_read` sobre product.template usa domain con write_date > since.
    // (La sonda fields_get está cacheada 5 min, así que la segunda corrida no la repite.)
    const secondSearchArgs = catalogSearchCall(calls, 1)?.args as unknown[];
    assert.deepEqual(secondSearchArgs, [[['write_date', '>', '2026-08-01 00:00:00']]]);
    assert.equal(delta.length, 1);
  });

  it('active && sale_ok gobiernan published; sale_ok=false → published=false', async () => {
    const { factory } = fakeClient(() => [
      {
        id: 1,
        default_code: 'ACT-NOSALE',
        name: 'Solo interno',
        list_price: 500,
        categ_id: false,
        image_1920: false,
        write_date: '2026-01-01 00:00:00',
        active: true,
        sale_ok: false,
      },
    ]);
    const rows = await new OdooErpAdapter(factory).getCatalogChanges(null, ctx());
    assert.equal(rows[0]?.active, true);
    assert.equal(rows[0]?.published, false);
    assert.equal(rows[0]?.category_code, null);
  });

  it('filas con default_code: false se saltean', async () => {
    const { factory } = fakeClient(() => [
      { id: 1, default_code: false, name: 'Sin código', list_price: 10, active: true, sale_ok: true },
      { id: 2, default_code: 'REAL', name: 'Con código', list_price: 20, active: true, sale_ok: true },
    ]);
    const rows = await new OdooErpAdapter(factory).getCatalogChanges(null, ctx());
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.code, 'REAL');
  });

  it('only_published=true suma [is_published,=,true] al domain', async () => {
    const { factory, calls } = fakeClient(() => []);
    const settings: ErpOdooSettings = { ...DEFAULT_SETTINGS, only_published: true };
    await new OdooErpAdapter(factory).getCatalogChanges(null, ctx(settings));
    assert.deepEqual(catalogSearchCall(calls)?.args, [[['is_published', '=', true]]]);
  });

  it('only_published=true + since → domain combina write_date > y is_published', async () => {
    const { factory, calls } = fakeClient(() => []);
    const settings: ErpOdooSettings = { ...DEFAULT_SETTINGS, only_published: true };
    await new OdooErpAdapter(factory).getCatalogChanges('2026-09-01 00:00:00', ctx(settings));
    assert.deepEqual(catalogSearchCall(calls)?.args, [
      [
        ['write_date', '>', '2026-09-01 00:00:00'],
        ['is_published', '=', true],
      ],
    ]);
  });

  it('only_published unset → domain sin is_published (compat con clientes sin website_sale)', async () => {
    const { factory, calls } = fakeClient(() => []);
    await new OdooErpAdapter(factory).getCatalogChanges(null, ctx());
    assert.deepEqual(catalogSearchCall(calls)?.args, [[]]);
  });

  it('sonda product.template.fields_get antes del search_read (una vez, cacheada)', async () => {
    const { factory, calls } = fakeClient(({ model, method }) => {
      if (model === 'product.template' && method === 'fields_get') {
        // La instancia expone description_ecommerce.
        return { description_ecommerce: { type: 'html' } };
      }
      return [];
    });
    const adapter = new OdooErpAdapter(factory);
    await adapter.getCatalogChanges(null, ctx());
    await adapter.getCatalogChanges(null, ctx()); // segunda corrida — no debe re-sondar

    const probes = calls.filter(
      (c) => c.model === 'product.template' && c.method === 'fields_get'
    );
    assert.equal(probes.length, 1, 'fields_get se cachea entre corridas dentro del TTL');
    assert.deepEqual(probes[0]?.args, [['description_ecommerce']]);

    // Con description_ecommerce presente, el search_read debe pedirlo.
    const searchFields = catalogSearchCall(calls)?.kwargs.fields as string[];
    assert.ok(searchFields.includes('description_ecommerce'));
    assert.ok(searchFields.includes('weight'));
  });

  it('sin description_ecommerce en la instancia → no se pide en el search_read (compat)', async () => {
    const { factory, calls } = fakeClient(({ model, method }) => {
      if (model === 'product.template' && method === 'fields_get') {
        // Instancia SIN el campo — fields_get devuelve dict vacío.
        return {};
      }
      return [];
    });
    await new OdooErpAdapter(factory).getCatalogChanges(null, ctx());

    const searchFields = catalogSearchCall(calls)?.kwargs.fields as string[];
    assert.equal(
      searchFields.includes('description_ecommerce'),
      false,
      'campo opcional ausente no se debe pedir'
    );
    assert.ok(searchFields.includes('weight'), 'weight es standard y siempre se pide');
  });

  it('sonda fields_get que falla → sigue con base fields (fail-open)', async () => {
    const { factory, calls } = fakeClient(({ model, method }) => {
      if (model === 'product.template' && method === 'fields_get') {
        return new Error('boom');
      }
      return [];
    });
    await new OdooErpAdapter(factory).getCatalogChanges(null, ctx());

    const searchFields = catalogSearchCall(calls)?.kwargs.fields as string[];
    assert.equal(searchFields.includes('description_ecommerce'), false);
    assert.ok(searchFields.includes('weight'));
  });

  it('description_ecommerce HTML → product.description en Markdown', async () => {
    const { factory } = fakeClient(({ model, method }) => {
      if (model === 'product.template' && method === 'fields_get') {
        return { description_ecommerce: { type: 'html' } };
      }
      if (model === 'product.template' && method === 'search_read') {
        return [
          {
            id: 1,
            default_code: 'PRO-1',
            name: 'Producto',
            list_price: 100,
            categ_id: false,
            write_date: '2026-09-17 12:00:00',
            active: true,
            sale_ok: true,
            description_ecommerce:
              '<div data-oe-version="1.2">Moderniza el aula con este <b>set</b>.</div>',
            weight: 0.9,
          },
        ];
      }
      return [];
    });
    const rows = await new OdooErpAdapter(factory).getCatalogChanges(null, ctx());
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.description, 'Moderniza el aula con este **set**.');
    assert.equal(rows[0]?.weight, 0.9);
  });

  it('description_ecommerce ausente/false → description queda null (compat)', async () => {
    const { factory } = fakeClient(({ model, method }) => {
      if (model === 'product.template' && method === 'fields_get') {
        return { description_ecommerce: { type: 'html' } };
      }
      if (model === 'product.template' && method === 'search_read') {
        return [
          {
            id: 1,
            default_code: 'PRO-1',
            name: 'Producto',
            list_price: 100,
            active: true,
            sale_ok: true,
            description_ecommerce: false,
            weight: 0,
          },
        ];
      }
      return [];
    });
    const rows = await new OdooErpAdapter(factory).getCatalogChanges(null, ctx());
    assert.equal(rows[0]?.description, null);
    // weight = 0 se normaliza a null para no disparar diffs vacíos en el planner.
    assert.equal(rows[0]?.weight, null);
  });

  it('weight negativo o no finito → null', async () => {
    const { factory } = fakeClient(({ model, method }) => {
      if (model === 'product.template' && method === 'fields_get') return {};
      if (model === 'product.template' && method === 'search_read') {
        return [
          {
            id: 1,
            default_code: 'PRO-NEG',
            name: 'X',
            list_price: 10,
            active: true,
            sale_ok: true,
            weight: -1,
          },
          {
            id: 2,
            default_code: 'PRO-NAN',
            name: 'Y',
            list_price: 10,
            active: true,
            sale_ok: true,
            weight: Number.NaN,
          },
        ];
      }
      return [];
    });
    const rows = await new OdooErpAdapter(factory).getCatalogChanges(null, ctx());
    assert.equal(rows.find((r) => r.code === 'PRO-NEG')?.weight, null);
    assert.equal(rows.find((r) => r.code === 'PRO-NAN')?.weight, null);
  });
});

describe('OdooErpAdapter — fetchCategories', () => {
  it('aplana el árbol con parent_id (many2one) y arma código `odoo:<id>`', async () => {
    const { factory, calls } = fakeClient(({ model, method }) => {
      if (model === 'product.category' && method === 'search_read') {
        return [
          { id: 1, name: 'All', parent_id: false, complete_name: 'All' },
          {
            id: 2,
            name: 'Saleable',
            parent_id: [1, 'All'] as [number, string],
            complete_name: 'All / Saleable',
          },
          {
            id: 3,
            name: 'Services',
            parent_id: [1, 'All'] as [number, string],
            complete_name: 'All / Services',
          },
        ];
      }
      return [];
    });
    const result = await new OdooErpAdapter(factory).fetchCategories(ctx());
    assert.equal(calls[0]?.model, 'product.category');
    assert.equal(result.length, 3);
    // Padres antes que hijos
    assert.equal(result[0]?.code, 'ODOO:1');
    assert.equal(result[0]?.parent_code, null);
    assert.equal(result[0]?.level, 0);
    assert.equal(result[1]?.code, 'ODOO:2');
    assert.equal(result[1]?.parent_code, 'ODOO:1');
    assert.equal(result[1]?.level, 1);
    assert.equal(result[2]?.code, 'ODOO:3');
    assert.equal(result[2]?.parent_code, 'ODOO:1');
    // Ranks: 0 en la raíz (solo un nodo), 0 y 1 entre hijos de la raíz.
    assert.equal(result[0]?.rank, 0);
    assert.equal(result[1]?.rank, 0);
    assert.equal(result[2]?.rank, 1);
  });

  it('filas sin name se descartan (no hay categoría sin display en Odoo)', async () => {
    const { factory } = fakeClient(() => [
      { id: 1, name: '', parent_id: false, complete_name: '' },
      { id: 2, name: 'Válida', parent_id: false, complete_name: 'Válida' },
    ]);
    const result = await new OdooErpAdapter(factory).fetchCategories(ctx());
    assert.equal(result.length, 1);
    assert.equal(result[0]?.code, 'ODOO:2');
  });
});

describe('OdooErpAdapter — fetchProductImage', () => {
  it('base64 no vacío → Buffer PNG', async () => {
    // Pequeño PNG codificado (bytes decodificables).
    const base64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
    const { factory, calls } = fakeClient(({ model, method }) => {
      if (model === 'product.product' && method === 'search_read') {
        return [{ id: 27, product_tmpl_id: [10, 'Base'] as [number, string], image_1920: base64 }];
      }
      return [];
    });
    const result = await new OdooErpAdapter(factory).fetchProductImage('E-COM11', ctx());
    assert.equal(calls[0]?.model, 'product.product');
    // Domain con default_code = code y limit 1
    assert.deepEqual(calls[0]?.args, [[['default_code', '=', 'E-COM11']]]);
    assert.equal(calls[0]?.kwargs.limit, 1);
    assert.notEqual(result, null);
    assert.equal(result?.mime_type, 'image/png');
    assert.equal(result?.extension, 'png');
    assert.equal(result?.content.length, 8);
  });

  it('sin filas → null (artículo sin foto en Odoo es el caso normal)', async () => {
    const { factory } = fakeClient(() => []);
    const result = await new OdooErpAdapter(factory).fetchProductImage('MISSING', ctx());
    assert.equal(result, null);
  });

  it('image_1920: false → null (Odoo devuelve `false` cuando el registro no tiene foto)', async () => {
    const { factory } = fakeClient(() => [
      { id: 27, product_tmpl_id: [10, 'Base'] as [number, string], image_1920: false },
    ]);
    const result = await new OdooErpAdapter(factory).fetchProductImage('E-COM11', ctx());
    assert.equal(result, null);
  });

  it('código vacío → null sin request', async () => {
    const { factory, calls } = fakeClient(() => []);
    const result = await new OdooErpAdapter(factory).fetchProductImage('   ', ctx());
    assert.equal(result, null);
    assert.equal(calls.length, 0);
  });
});

describe('OdooErpAdapter — notifySale', () => {
  /**
   * Payload base con dos líneas. Cada test lo clona y ajusta lo mínimo para
   * mantener la intención visible en cada caso.
   */
  const basePayload: ErpSalePayload = {
    event_key: 'order.placed:order_1',
    order_id: 'order_1',
    display_id: 42,
    created_at: '2026-08-30T12:00:00Z',
    country_code: 'AR',
    currency_code: 'ars',
    customer: {
      id: 'cus_1',
      email: 'juan@example.com',
      first_name: 'Juan',
      last_name: 'Pérez',
      phone: '+541155555555',
      document: { type: 'CUIT', number: '20-12345678-9' },
    },
    items: [
      {
        sku: 'SKU-A',
        title: 'Producto A',
        quantity: 2,
        unit_price: 100.5,
        total: 201,
      },
      {
        sku: 'SKU-B',
        title: 'Producto B',
        quantity: 1,
        unit_price: 50,
        total: 50,
      },
    ],
    totals: { subtotal: 251, discount: 0, shipping: 0, tax: 0, total: 251 },
    payment: { provider_id: 'pp_stripe', captured_amount: 251, currency_code: 'ars' },
    shipping: {
      method: 'Standard',
      address: {
        street: 'Av. Corrientes 1234',
        city: 'CABA',
        province: 'CABA',
        postal_code: 'C1043',
        country_code: 'AR',
      },
    },
  };

  /**
   * Handler compuesto por casos: la clave `model.method` (+ opcional
   * discriminador por args) devuelve el resultado. Simplifica setups de flujo
   * multi-request donde el orden importa.
   */
  function withSequence(
    responders: Record<string, (call: CallRecord) => unknown>
  ): (call: CallRecord) => unknown {
    return (call) => {
      const key = `${call.model}.${call.method}`;
      const responder = responders[key];
      if (!responder) {
        throw new Error(`Unexpected call: ${key} — args=${JSON.stringify(call.args)}`);
      }
      return responder(call);
    };
  }

  it('duplicate: si existe sale.order con client_order_ref, devuelve duplicate y NO crea', async () => {
    const { factory, calls } = fakeClient(
      withSequence({
        'sale.order.search_read': () => [{ id: 777, name: 'S00042' }],
      })
    );
    const adapter = new OdooErpAdapter(factory);
    const result = await adapter.notifySale(basePayload, ctx());
    assert.deepEqual(result, { status: 'duplicate', external_ref: '777' });
    // Solo se llamó a la búsqueda de idempotencia.
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.model, 'sale.order');
    assert.equal(calls[0]?.method, 'search_read');
    assert.deepEqual(calls[0]?.args, [[['client_order_ref', '=', 'order_1']]]);
    assert.equal(calls[0]?.kwargs.limit, 1);
  });

  it('happy path partner nuevo: crea partner, crea sale.order con 2 líneas, confirma', async () => {
    const { factory, calls } = fakeClient(
      withSequence({
        // Idempotencia: no existe.
        'sale.order.search_read': () => [],
        // Partner: no aparece ni por vat ni por email → se crea.
        'res.partner.search_read': () => [],
        'res.partner.create': () => 501,
        // Productos: los dos SKUs existen.
        'product.product.search_read': () => [
          { id: 11, default_code: 'SKU-A' },
          { id: 22, default_code: 'SKU-B' },
        ],
        'sale.order.create': () => 999,
        'sale.order.action_confirm': () => true,
      })
    );
    const adapter = new OdooErpAdapter(factory);
    const result = await adapter.notifySale(basePayload, ctx());
    assert.equal(result.status, 'sent');
    assert.equal(result.external_ref, '999');

    // Se buscó por VAT primero (payload trae CUIT).
    const partnerSearches = calls.filter(
      (c) => c.model === 'res.partner' && c.method === 'search_read'
    );
    assert.equal(partnerSearches.length, 2);
    // El adapter preserva guiones/formato del VAT — Odoo acepta VATs con
    // formato (`ES-B12345678`, `20-12345678-9`) y hace la validación por país.
    assert.deepEqual(partnerSearches[0]?.args, [[['vat', '=', '20-12345678-9']]]);
    assert.deepEqual(partnerSearches[1]?.args, [[['email', '=', 'juan@example.com']]]);

    // Partner create con nombre + vat + email.
    const partnerCreate = calls.find((c) => c.model === 'res.partner' && c.method === 'create');
    const partnerBody = partnerCreate?.args[0] as Record<string, unknown>;
    assert.equal(partnerBody.name, 'Juan Pérez');
    assert.equal(partnerBody.email, 'juan@example.com');
    assert.equal(partnerBody.vat, '20-12345678-9');
    assert.equal(partnerBody.phone, '+541155555555');
    assert.equal(partnerBody.street, 'Av. Corrientes 1234');
    assert.equal(partnerBody.city, 'CABA');
    assert.equal(partnerBody.zip, 'C1043');
    // v1: country_id no se manda.
    assert.equal(partnerBody.country_id, undefined);

    // sale.order create: partner_id, client_order_ref, order_line con 2 líneas.
    const orderCreate = calls.find((c) => c.model === 'sale.order' && c.method === 'create');
    const orderBody = orderCreate?.args[0] as Record<string, unknown>;
    assert.equal(orderBody.partner_id, 501);
    assert.equal(orderBody.client_order_ref, 'order_1');
    const lines = orderBody.order_line as Array<[number, number, Record<string, unknown>]>;
    assert.equal(lines.length, 2);
    // Comando "create nested": [0, 0, {...}]
    assert.equal(lines[0]?.[0], 0);
    assert.equal(lines[0]?.[1], 0);
    assert.equal(lines[0]?.[2]?.product_id, 11);
    assert.equal(lines[0]?.[2]?.product_uom_qty, 2);
    assert.equal(lines[0]?.[2]?.price_unit, 100.5);
    assert.equal(lines[0]?.[2]?.name, 'Producto A');
    assert.equal(lines[1]?.[2]?.product_id, 22);
    assert.equal(lines[1]?.[2]?.product_uom_qty, 1);
    assert.equal(lines[1]?.[2]?.price_unit, 50);

    // Confirmación con el ID.
    const confirm = calls.find((c) => c.model === 'sale.order' && c.method === 'action_confirm');
    assert.deepEqual(confirm?.args, [[999]]);
  });

  it('partner existente por vat: no busca por email, reutiliza el ID', async () => {
    const { factory, calls } = fakeClient(
      withSequence({
        'sale.order.search_read': () => [],
        'res.partner.search_read': (call) => {
          const domain = (call.args as unknown[])[0] as unknown[][];
          const field = (domain[0] as unknown[])[0];
          if (field === 'vat') return [{ id: 300, name: 'Juan', vat: '20123456789' }];
          throw new Error('should not search by email when vat matched');
        },
        'product.product.search_read': () => [
          { id: 11, default_code: 'SKU-A' },
          { id: 22, default_code: 'SKU-B' },
        ],
        'sale.order.create': () => 999,
        'sale.order.action_confirm': () => true,
      })
    );
    const adapter = new OdooErpAdapter(factory);
    const result = await adapter.notifySale(basePayload, ctx());
    assert.equal(result.status, 'sent');

    // Debe haber UNA sola búsqueda de partner (por vat) y ninguna por email.
    const partnerSearches = calls.filter(
      (c) => c.model === 'res.partner' && c.method === 'search_read'
    );
    assert.equal(partnerSearches.length, 1);
    // Y sin partner.create.
    assert.equal(
      calls.find((c) => c.model === 'res.partner' && c.method === 'create'),
      undefined
    );

    const orderCreate = calls.find((c) => c.model === 'sale.order' && c.method === 'create');
    const orderBody = orderCreate?.args[0] as Record<string, unknown>;
    assert.equal(orderBody.partner_id, 300);
  });

  it('partner existente por email cuando no hay vat: reutiliza el ID sin buscar por vat', async () => {
    const { factory, calls } = fakeClient(
      withSequence({
        'sale.order.search_read': () => [],
        'res.partner.search_read': (call) => {
          const domain = (call.args as unknown[])[0] as unknown[][];
          const field = (domain[0] as unknown[])[0];
          if (field === 'email') return [{ id: 401, name: 'Juan', email: 'juan@example.com' }];
          throw new Error(`unexpected search by ${String(field)}`);
        },
        'product.product.search_read': () => [
          { id: 11, default_code: 'SKU-A' },
          { id: 22, default_code: 'SKU-B' },
        ],
        'sale.order.create': () => 1000,
        'sale.order.action_confirm': () => true,
      })
    );
    const payload: ErpSalePayload = {
      ...basePayload,
      customer: { ...basePayload.customer, document: { type: null, number: null } },
    };
    const adapter = new OdooErpAdapter(factory);
    const result = await adapter.notifySale(payload, ctx());
    assert.equal(result.status, 'sent');

    // Sin vat → una sola búsqueda de partner, por email.
    const partnerSearches = calls.filter(
      (c) => c.model === 'res.partner' && c.method === 'search_read'
    );
    assert.equal(partnerSearches.length, 1);
    const domain = (partnerSearches[0]?.args as unknown[])[0] as unknown[][];
    assert.equal((domain[0] as unknown[])[0], 'email');

    const orderCreate = calls.find((c) => c.model === 'sale.order' && c.method === 'create');
    const orderBody = orderCreate?.args[0] as Record<string, unknown>;
    assert.equal(orderBody.partner_id, 401);
  });

  it('shipping_item_code + shipping_amount > 0 → agrega línea de envío con el product_id resuelto', async () => {
    const settings: ErpOdooSettings = { ...DEFAULT_SETTINGS, shipping_item_code: 'SHIP-01' };
    const { factory, calls } = fakeClient(
      withSequence({
        'sale.order.search_read': () => [],
        'res.partner.search_read': (call) => {
          const domain = (call.args as unknown[])[0] as unknown[][];
          const field = (domain[0] as unknown[])[0];
          if (field === 'vat') return [{ id: 300, name: 'Juan', vat: '20123456789' }];
          return [];
        },
        'product.product.search_read': (call) => {
          const domain = (call.args as unknown[])[0] as unknown[][];
          const op = (domain[0] as unknown[])[1];
          const value = (domain[0] as unknown[])[2];
          // Batch de las líneas: "in"
          if (op === 'in') {
            return [
              { id: 11, default_code: 'SKU-A' },
              { id: 22, default_code: 'SKU-B' },
            ];
          }
          // Envío: "=" y valor SHIP-01
          if (op === '=' && value === 'SHIP-01') {
            return [{ id: 55, default_code: 'SHIP-01' }];
          }
          throw new Error(`unexpected product lookup: op=${String(op)} value=${String(value)}`);
        },
        'sale.order.create': () => 1234,
        'sale.order.action_confirm': () => true,
      })
    );
    const payload: ErpSalePayload = {
      ...basePayload,
      totals: { ...basePayload.totals, shipping: 15.5, total: 266.5 },
    };
    const adapter = new OdooErpAdapter(factory);
    const result = await adapter.notifySale(payload, ctx(settings));
    assert.equal(result.status, 'sent');

    const orderCreate = calls.find((c) => c.model === 'sale.order' && c.method === 'create');
    const orderBody = orderCreate?.args[0] as Record<string, unknown>;
    const lines = orderBody.order_line as Array<[number, number, Record<string, unknown>]>;
    // 2 líneas normales + 1 de envío
    assert.equal(lines.length, 3);
    const shippingLine = lines[2]?.[2];
    assert.equal(shippingLine?.product_id, 55);
    assert.equal(shippingLine?.product_uom_qty, 1);
    assert.equal(shippingLine?.price_unit, 15.5);
    // note NO se setea cuando el envío se factura como línea.
    assert.equal(orderBody.note, undefined);
  });

  it('shipping_item_code vacío → NO agrega línea de envío; envío queda como nota', async () => {
    const { factory, calls } = fakeClient(
      withSequence({
        'sale.order.search_read': () => [],
        'res.partner.search_read': (call) => {
          const domain = (call.args as unknown[])[0] as unknown[][];
          const field = (domain[0] as unknown[])[0];
          if (field === 'vat') return [{ id: 300, name: 'Juan', vat: '20123456789' }];
          return [];
        },
        'product.product.search_read': () => [
          { id: 11, default_code: 'SKU-A' },
          { id: 22, default_code: 'SKU-B' },
        ],
        'sale.order.create': () => 1234,
        'sale.order.action_confirm': () => true,
      })
    );
    const payload: ErpSalePayload = {
      ...basePayload,
      totals: { ...basePayload.totals, shipping: 15.5, total: 266.5 },
    };
    const adapter = new OdooErpAdapter(factory);
    await adapter.notifySale(payload, ctx());

    const orderCreate = calls.find((c) => c.model === 'sale.order' && c.method === 'create');
    const orderBody = orderCreate?.args[0] as Record<string, unknown>;
    const lines = orderBody.order_line as Array<[number, number, Record<string, unknown>]>;
    assert.equal(lines.length, 2);
    // El envío va como nota del pedido.
    assert.match(String(orderBody.note ?? ''), /Env[íi]o/);
    assert.match(String(orderBody.note ?? ''), /15\.5/);
  });

  it('SKU no existe en Odoo → ErpNonRetryableError con mensaje claro', async () => {
    const { factory } = fakeClient(
      withSequence({
        'sale.order.search_read': () => [],
        'res.partner.search_read': (call) => {
          const domain = (call.args as unknown[])[0] as unknown[][];
          const field = (domain[0] as unknown[])[0];
          if (field === 'vat') return [{ id: 300 }];
          return [];
        },
        // Falta SKU-B en la respuesta.
        'product.product.search_read': () => [{ id: 11, default_code: 'SKU-A' }],
      })
    );
    const adapter = new OdooErpAdapter(factory);
    await assert.rejects(
      () => adapter.notifySale(basePayload, ctx()),
      (error: unknown) => {
        assert.ok(error instanceof ErpNonRetryableError);
        assert.match((error as Error).message, /SKU-B/);
        assert.match((error as Error).message, /default_code/);
        return true;
      }
    );
  });

  it('shipping SKU no existe → ErpNonRetryableError con mensaje específico de shipping', async () => {
    const settings: ErpOdooSettings = { ...DEFAULT_SETTINGS, shipping_item_code: 'SHIP-XX' };
    const { factory } = fakeClient(
      withSequence({
        'sale.order.search_read': () => [],
        'res.partner.search_read': (call) => {
          const domain = (call.args as unknown[])[0] as unknown[][];
          const field = (domain[0] as unknown[])[0];
          if (field === 'vat') return [{ id: 300 }];
          return [];
        },
        'product.product.search_read': (call) => {
          const domain = (call.args as unknown[])[0] as unknown[][];
          const op = (domain[0] as unknown[])[1];
          if (op === 'in') {
            return [
              { id: 11, default_code: 'SKU-A' },
              { id: 22, default_code: 'SKU-B' },
            ];
          }
          // Búsqueda del shipping product: no existe.
          return [];
        },
      })
    );
    const payload: ErpSalePayload = {
      ...basePayload,
      totals: { ...basePayload.totals, shipping: 15.5, total: 266.5 },
    };
    const adapter = new OdooErpAdapter(factory);
    await assert.rejects(
      () => adapter.notifySale(payload, ctx(settings)),
      (error: unknown) => {
        assert.ok(error instanceof ErpNonRetryableError);
        assert.match((error as Error).message, /SHIP-XX/);
        assert.match((error as Error).message, /shipping_item_code/);
        return true;
      }
    );
  });

  it('auto_confirm: false → NO llama a action_confirm', async () => {
    const settings: ErpOdooSettings = { ...DEFAULT_SETTINGS, auto_confirm: false };
    const { factory, calls } = fakeClient(
      withSequence({
        'sale.order.search_read': () => [],
        'res.partner.search_read': (call) => {
          const domain = (call.args as unknown[])[0] as unknown[][];
          const field = (domain[0] as unknown[])[0];
          if (field === 'vat') return [{ id: 300 }];
          return [];
        },
        'product.product.search_read': () => [
          { id: 11, default_code: 'SKU-A' },
          { id: 22, default_code: 'SKU-B' },
        ],
        'sale.order.create': () => 4321,
      })
    );
    const adapter = new OdooErpAdapter(factory);
    const result = await adapter.notifySale(basePayload, ctx(settings));
    assert.equal(result.status, 'sent');
    assert.equal(result.external_ref, '4321');
    assert.equal(
      calls.find((c) => c.model === 'sale.order' && c.method === 'action_confirm'),
      undefined
    );
  });

  it('SKU faltante en la orden → ErpNonRetryableError sin llamar a Odoo', async () => {
    const { factory, calls } = fakeClient(() => {
      throw new Error('should not call Odoo when SKU is missing');
    });
    const payload: ErpSalePayload = {
      ...basePayload,
      items: [{ ...basePayload.items[0]!, sku: null }],
    };
    const adapter = new OdooErpAdapter(factory);
    await assert.rejects(
      () => adapter.notifySale(payload, ctx()),
      (error: unknown) => {
        assert.ok(error instanceof ErpNonRetryableError);
        assert.match((error as Error).message, /SKU/);
        return true;
      }
    );
    assert.equal(calls.length, 0);
  });
});

/**
 * Contrato del envío al ERP con campos opcionales (Alumnos / escuela).
 *
 * Regla dura: el `sale.order.create` NUNCA se rompe porque el custom field no
 * exista en Odoo. El adapter sondea `fields_get` una vez cada 5min y filtra
 * los campos ausentes silenciosamente. Con los campos creados, viajan; sin
 * ellos, se omiten y la orden se crea igual con el resto de los datos.
 */
describe('OdooErpAdapter — notifySale con custom fields opcionales (Alumnos)', () => {
  const basePayload: ErpSalePayload = {
    event_key: 'order.placed:order_school',
    order_id: 'order_school',
    display_id: 100,
    created_at: '2026-09-15T12:00:00Z',
    country_code: 'AR',
    currency_code: 'ars',
    customer: {
      id: 'cus_1', email: 'ana@example.com', first_name: 'Ana', last_name: 'García',
      phone: '+541155555555', document: { type: 'CUIT', number: '20-40123456-1' },
    },
    items: [{ sku: 'EDU-KIT-4', title: 'Kit robótica', quantity: 1, unit_price: 100, total: 100 }],
    totals: { subtotal: 100, discount: 0, shipping: 0, tax: 0, total: 100 },
    payment: { provider_id: 'pp_mp', captured_amount: 100, currency_code: 'ars' },
    shipping: { method: 'Standard', address: { street: 'X', city: 'CABA', province: 'CABA', postal_code: 'C1043', country_code: 'AR' } },
    school: { external_ref: 'san_agustin', name: 'Colegio San Agustín', source_site_id: 'ds_01' },
    student_assignments: {
      schema_version: '1.0',
      items: [{
        sku: 'EDU-KIT-4', quantity: 1,
        recipients: [{ external_id: 'p-1', first_name: 'Juan', last_name: 'Pérez', document: '45123456', grade: '4A', quantity: 1 }],
      }],
    },
  };

  function withProbe(
    presentFields: string[],
    otherResponders: Record<string, (call: CallRecord) => unknown> = {}
  ): (call: CallRecord) => unknown {
    return (call) => {
      const key = `${call.model}.${call.method}`;
      if (key === 'sale.order.fields_get') {
        const requested = (call.args[0] as string[]) ?? [];
        // Odoo omite silenciosamente los fields que no existen — repliquemos ese contrato.
        return Object.fromEntries(requested.filter((f) => presentFields.includes(f)).map((f) => [f, { type: 'char' }]));
      }
      const responder = otherResponders[key];
      if (!responder) throw new Error(`Unexpected call: ${key} — args=${JSON.stringify(call.args)}`);
      return responder(call);
    };
  }

  const successResponders = {
    'sale.order.search_read': () => [],
    'res.partner.search_read': () => [],
    'res.partner.create': () => 501,
    'product.product.search_read': () => [{ id: 11, default_code: 'EDU-KIT-4' }],
    'sale.order.create': () => 999,
    'sale.order.action_confirm': () => true,
  };

  it('todos los custom fields existen → viajan los 4 en el create', async () => {
    const { factory, calls } = fakeClient(withProbe([...['x_school_external_ref', 'x_school_name', 'x_source_site_id', 'x_student_assignments']], successResponders));
    const adapter = new OdooErpAdapter(factory);
    const result = await adapter.notifySale(basePayload, ctx());
    assert.equal(result.status, 'sent');
    const orderCreate = calls.find((c) => c.model === 'sale.order' && c.method === 'create');
    const body = orderCreate?.args[0] as Record<string, unknown>;
    assert.equal(body.x_school_external_ref, 'san_agustin');
    assert.equal(body.x_school_name, 'Colegio San Agustín');
    assert.equal(body.x_source_site_id, 'ds_01');
    // student_assignments viaja como JSON.stringify (compat con Text y Jsonb)
    assert.equal(typeof body.x_student_assignments, 'string');
    const parsed = JSON.parse(body.x_student_assignments as string);
    assert.equal(parsed.schema_version, '1.0');
    assert.equal(parsed.items[0].sku, 'EDU-KIT-4');
  });

  it('ningún custom field existe → orden se crea sin ellos, no rompe', async () => {
    const { factory, calls } = fakeClient(withProbe([], successResponders));
    const adapter = new OdooErpAdapter(factory);
    const result = await adapter.notifySale(basePayload, ctx());
    assert.equal(result.status, 'sent');
    const orderCreate = calls.find((c) => c.model === 'sale.order' && c.method === 'create');
    const body = orderCreate?.args[0] as Record<string, unknown>;
    assert.equal('x_school_external_ref' in body, false);
    assert.equal('x_school_name' in body, false);
    assert.equal('x_source_site_id' in body, false);
    assert.equal('x_student_assignments' in body, false);
    // Los fields core siguen ahí — la orden se creó completa
    assert.equal(body.client_order_ref, 'order_school');
    assert.equal(body.partner_id, 501);
    assert.ok(Array.isArray(body.order_line));
  });

  it('subset: solo los fields presentes se envían, los faltantes se omiten', async () => {
    const { factory, calls } = fakeClient(withProbe(['x_school_name', 'x_student_assignments'], successResponders));
    const adapter = new OdooErpAdapter(factory);
    await adapter.notifySale(basePayload, ctx());
    const body = (calls.find((c) => c.model === 'sale.order' && c.method === 'create')?.args[0]) as Record<string, unknown>;
    assert.equal(body.x_school_name, 'Colegio San Agustín');
    assert.equal(typeof body.x_student_assignments, 'string');
    assert.equal('x_school_external_ref' in body, false);
    assert.equal('x_source_site_id' in body, false);
  });

  it('probe falla (network error) → orden se crea sin los custom fields, no rompe', async () => {
    const { factory, calls } = fakeClient((call) => {
      const key = `${call.model}.${call.method}`;
      if (key === 'sale.order.fields_get') throw new Error('ECONNREFUSED');
      const r = (successResponders as any)[key];
      if (!r) throw new Error(`Unexpected: ${key}`);
      return r(call);
    });
    const adapter = new OdooErpAdapter(factory);
    const result = await adapter.notifySale(basePayload, ctx());
    assert.equal(result.status, 'sent');
    const body = (calls.find((c) => c.model === 'sale.order' && c.method === 'create')?.args[0]) as Record<string, unknown>;
    assert.equal('x_school_name' in body, false);
    assert.equal('x_student_assignments' in body, false);
  });

  it('cache: dos envíos consecutivos hacen UN solo fields_get', async () => {
    const { factory, calls } = fakeClient(withProbe(['x_school_name'], successResponders));
    const adapter = new OdooErpAdapter(factory);
    await adapter.notifySale(basePayload, ctx());
    await adapter.notifySale({ ...basePayload, order_id: 'order_school_2', event_key: 'order.placed:order_school_2' }, ctx());
    const probes = calls.filter((c) => c.model === 'sale.order' && c.method === 'fields_get');
    assert.equal(probes.length, 1, 'segundo envío debe reusar cache — evita un round-trip por orden');
  });

  it('multi-tenant: dos baseUrl distintas sondean por separado', async () => {
    const { factory, calls } = fakeClient(withProbe(['x_school_name'], successResponders));
    const adapter = new OdooErpAdapter(factory);
    await adapter.notifySale(basePayload, ctx({ ...DEFAULT_SETTINGS, base_url: 'http://tenant-a:8069' }));
    await adapter.notifySale({ ...basePayload, order_id: 'o2', event_key: 'e2' }, ctx({ ...DEFAULT_SETTINGS, base_url: 'http://tenant-b:8069' }));
    const probes = calls.filter((c) => c.model === 'sale.order' && c.method === 'fields_get');
    assert.equal(probes.length, 2, 'cada tenant Odoo tiene que sondear independiente');
  });

  it('sin payload.school ni payload.student_assignments → NO sondea (tienda principal)', async () => {
    const { factory, calls } = fakeClient(withProbe([], successResponders));
    const adapter = new OdooErpAdapter(factory);
    const mainStorePayload: ErpSalePayload = { ...basePayload, school: null, student_assignments: null };
    await adapter.notifySale(mainStorePayload, ctx());
    const probes = calls.filter((c) => c.model === 'sale.order' && c.method === 'fields_get');
    assert.equal(probes.length, 0, 'sin data extra, saltear la sonda ahorra un round-trip');
  });
});

describe('OdooRpcClient — construcción y config', () => {
  // Sanity check del cliente real: el body JSON-RPC lleva db + uid + api_key
  // en args, y el context incluye allowed_company_ids cuando la config lo trae.
  it('POST /jsonrpc con execute_kw + context.allowed_company_ids desde la config', async () => {
    const captured: { url?: string; body?: unknown } = {};
    const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      captured.url = String(input);
      captured.body = init?.body ? JSON.parse(String(init.body)) : undefined;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ jsonrpc: '2.0', id: null, result: [{ id: 2 }] }),
        json: async () => ({ jsonrpc: '2.0', id: null, result: [{ id: 2 }] }),
      } as Response;
    }) as typeof globalThis.fetch;

    const client = new OdooRpcClient(
      {
        baseUrl: 'http://localhost:8069',
        db: 'mercatto-dev',
        uid: 2,
        apiKey: 'the-key',
        allowedCompanyIds: [1, 2],
      },
      fakeFetch
    );
    const result = await client.executeKw('res.users', 'read', [[2], ['login']]);
    assert.deepEqual(result, [{ id: 2 }]);
    assert.equal(captured.url, 'http://localhost:8069/jsonrpc');
    const body = captured.body as { params: { args: unknown[] } };
    const args = body.params.args;
    assert.equal(args[0], 'mercatto-dev');
    assert.equal(args[1], 2);
    assert.equal(args[2], 'the-key');
    assert.equal(args[3], 'res.users');
    assert.equal(args[4], 'read');
    const kwargs = args[6] as { context: { allowed_company_ids?: number[] } };
    assert.deepEqual(kwargs.context.allowed_company_ids, [1, 2]);
  });

  it('respuesta con error AccessError → ErpAuthError', async () => {
    const fakeFetch = (async () =>
      ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: 200,
              message: 'Access Denied',
              data: { name: 'odoo.exceptions.AccessError', message: 'You are not allowed.', debug: '' },
            },
          }),
        json: async () => ({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: 200,
            message: 'Access Denied',
            data: { name: 'odoo.exceptions.AccessError', message: 'You are not allowed.', debug: '' },
          },
        }),
      }) as Response) as typeof globalThis.fetch;
    const client = new OdooRpcClient(
      { baseUrl: 'http://localhost:8069', db: 'x', uid: 1, apiKey: 'k' },
      fakeFetch
    );
    await assert.rejects(
      () => client.executeKw('res.users', 'read', [[1]]),
      (error: unknown) => {
        assert.ok(error instanceof ErpAuthError);
        assert.match((error as Error).message, /not allowed/i);
        return true;
      }
    );
  });
});
