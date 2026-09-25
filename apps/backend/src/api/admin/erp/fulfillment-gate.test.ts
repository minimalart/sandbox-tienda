import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MedusaError } from '@medusajs/framework/utils';

import { erpFulfillmentGate } from './fulfillment-gate.ts';
import type { ErpConfigSettings } from '../../../modules/erp/types.ts';

/**
 * LA UBICACIÓN DE DESPACHO ES LA QUE FACTURA (DESDEELSUR-61).
 *
 * Antes la configuración dictaba el depósito facturador y este gate RECHAZABA
 * el fulfillment si la ubicación elegida no coincidía, mandando al operador a
 * ERP → Configuración. Ahora es al revés: el operador elige de dónde sale la
 * mercadería y eso determina la facturación.
 *
 * El test que más importa es el último: config y override dicen ELFLEIN, el
 * operador despacha desde MELIPAL, y factura MELIPAL. Si alguien "restaura"
 * `resolveBillingDeposito` acá adentro, ese test se cae.
 */
const ELFLEIN = 'sloc_elflein';
const MELIPAL = 'sloc_melipal';

const settings: ErpConfigSettings = {
  sales_notify: { trigger: 'fulfillment_created', billing_deposito: '1' },
  stock_sync: {
    deposito_map: [
      { deposito: '1', stock_location_id: ELFLEIN },
      { deposito: '2', stock_location_id: MELIPAL },
    ],
  },
} as ErpConfigSettings;

const UN_ITEM = [{ id: 'item_1', quantity: 2, detail: { quantity: 2, fulfilled_quantity: 0 } }];

type Caso = {
  settings?: ErpConfigSettings;
  trigger?: string;
  orderMetadata?: Record<string, unknown> | null;
  body?: Record<string, unknown>;
  items?: unknown[];
};

function correr(caso: Caso) {
  const updates: Array<{ id: string; metadata?: Record<string, unknown> }> = [];
  const logs: string[] = [];

  const config = {
    enabled: true,
    sales_notify_enabled: true,
    provider: 'zeus',
    settings: caso.settings ?? settings,
  };
  if (caso.trigger) {
    config.settings = {
      ...config.settings,
      sales_notify: { ...config.settings.sales_notify, trigger: caso.trigger },
    } as ErpConfigSettings;
  }

  const req = {
    params: { id: 'order_1' },
    body: caso.body ?? { location_id: MELIPAL, items: [{ id: 'item_1', quantity: 2 }] },
    auth_context: { actor_id: 'user_operador' },
    scope: {
      resolve: (key: string) => {
        if (key === 'erp') return { getActiveConfig: async () => config };
        if (key === 'logger') {
          return { info: (m: string) => logs.push(m), warn: () => {}, error: () => {} };
        }
        if (key === 'query') {
          return {
            graph: async ({ entity }: { entity: string }) => {
              if (entity === 'order') {
                return {
                  data: [
                    {
                      id: 'order_1',
                      metadata: caso.orderMetadata ?? null,
                      items: caso.items ?? UN_ITEM,
                    },
                  ],
                };
              }
              if (entity === 'stock_location') {
                return {
                  data: [
                    { id: ELFLEIN, name: 'Elflein' },
                    { id: MELIPAL, name: 'Melipal' },
                  ],
                };
              }
              throw new Error(`entidad inesperada: ${entity}`);
            },
          };
        }
        if (key === 'order') {
          return {
            updateOrders: async (rows: Array<{ id: string; metadata?: Record<string, unknown> }>) => {
              updates.push(...rows);
            },
          };
        }
        throw new Error(`no esperaba resolve('${key}')`);
      },
    },
  } as never;

  return new Promise<{ error: unknown; updates: typeof updates; logs: string[] }>((resolve) => {
    erpFulfillmentGate(req, {} as never, ((error?: unknown) => {
      resolve({ error: error ?? null, updates, logs });
    }) as never);
  });
}

const marca = (updates: Array<{ metadata?: Record<string, unknown> }>) =>
  updates[0]?.metadata?.erp_billing as { deposito?: string; stock_location_id?: string } | undefined;

describe('erpFulfillmentGate: factura la sucursal desde donde se despacha', () => {
  it('el depósito sale de la ubicación elegida por el operador', async () => {
    const { error, updates } = await correr({});
    assert.equal(error, null);
    assert.equal(marca(updates)?.deposito, '2');
    assert.equal(marca(updates)?.stock_location_id, MELIPAL);
  });

  it('LA INVERSIÓN: la config dice 1 y el override dice 1, pero despacha desde Melipal y factura 2', async () => {
    // Este es el caso que define la feature. Si vuelve a ganar la config, acá
    // saldría '1' y el operador facturaría desde un depósito que no eligió.
    const { error, updates } = await correr({
      orderMetadata: { erp_billing_deposito: '1' },
    });
    assert.equal(error, null);
    assert.equal(marca(updates)?.deposito, '2');
  });

  it('sin ubicación de despacho corta y la pide', async () => {
    const { error, updates } = await correr({ body: { items: [{ id: 'item_1', quantity: 2 }] } });
    assert.ok(error instanceof MedusaError);
    assert.match((error as Error).message, /Elegí la ubicación de despacho/);
    assert.equal(updates.length, 0, 'no puede marcar la orden si rechaza');
  });

  it('una ubicación sin mapear corta y dice cuáles sí están mapeadas', async () => {
    const { error } = await correr({
      body: { location_id: 'sloc_sucursal_nueva', items: [{ id: 'item_1', quantity: 2 }] },
    });
    assert.ok(error instanceof MedusaError);
    assert.match((error as Error).message, /no está mapeada a ningún depósito/);
    assert.match((error as Error).message, /Elflein/);
    assert.match((error as Error).message, /Melipal/);
  });

  it('NO exige depósito facturador en la config: sin él sigue facturando', async () => {
    // Es el punto de Camila: "no necesitamos un depósito facturador".
    const sinDefault = {
      ...settings,
      sales_notify: { trigger: 'fulfillment_created', billing_deposito: null },
    } as ErpConfigSettings;
    const { error, updates } = await correr({ settings: sinDefault });
    assert.equal(error, null);
    assert.equal(marca(updates)?.deposito, '2');
  });

  it('un fulfillment parcial se rechaza: una orden, una factura', async () => {
    const { error, updates } = await correr({
      body: { location_id: MELIPAL, items: [{ id: 'item_1', quantity: 1 }] },
    });
    assert.ok(error instanceof MedusaError);
    assert.match((error as Error).message, /UNA factura por pedido/);
    assert.equal(updates.length, 0);
  });

  it('con trigger payment_captured no hace nada, ni siquiera mira la ubicación', async () => {
    const { error, updates } = await correr({ trigger: 'payment_captured', body: {} });
    assert.equal(error, null);
    assert.equal(updates.length, 0);
  });
});
