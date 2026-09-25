import { it } from 'node:test';
import assert from 'node:assert/strict';
import { DELETE } from './route.ts';
import { DEMO_STORE_MODULE } from '../../../../modules/demo-store/index.ts';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

type Response = {
  status: (code: number) => Response;
  json: (data: any) => void;
};

type DeleteScenario = {
  siteId: string;
  demo: any;
  sessions: any[];
  orderCartLinks: any[];
  orders: any[];
};

type RunResult = {
  status: number;
  body: any;
  graphCalls: Array<{ entity: string }>;
  softDeleteDemoStoresCalled: boolean;
  softDeletedIds: string[];
  softDeleteImportJobsCalls: Array<{ demo_store_id: string }>;
};

function buildKnexStub(sessions: any[]) {
  return function knex(table: string) {
    return {
      where(_conditions: Record<string, any>) {
        return {
          select(_field: string) {
            if (table !== 'site_checkout_session') return [];
            return sessions;
          },
          first() {
            return sessions[0] ?? undefined;
          },
        };
      },
    };
  };
}

async function runDelete(scenario: DeleteScenario): Promise<RunResult> {
  const graphCalls: Array<{ entity: string }> = [];
  const softDeletedIds: string[] = [];
  const softDeleteImportJobsCalls: Array<{ demo_store_id: string }> = [];

  const query = {
    async graph({ entity, filters }: { entity: string; filters?: any }) {
      graphCalls.push({ entity });
      if (entity === 'order_cart') {
        const cartIds: string[] = Array.isArray(filters?.cart_id) ? filters.cart_id : [];
        return {
          data: scenario.orderCartLinks.filter((l) => cartIds.includes(l.cart_id)),
        };
      }
      if (entity === 'order') {
        const orderIds: string[] = Array.isArray(filters?.id) ? filters.id : [];
        return { data: scenario.orders.filter((o) => orderIds.includes(o.id)) };
      }
      if (entity === 'product') {
        return { data: [] };
      }
      return { data: [] };
    },
  };

  const service = {
    async retrieveDemoStore() {
      return scenario.demo;
    },
    async softDeleteImportJobs(filter: { demo_store_id: string }) {
      softDeleteImportJobsCalls.push(filter);
    },
    async softDeleteDemoStores(id: string) {
      softDeletedIds.push(id);
    },
  };

  const scope = {
    resolve(key: string) {
      if (key === DEMO_STORE_MODULE) return service;
      if (key === ContainerRegistrationKeys.LOGGER) return { error: () => {}, warn: () => {} };
      if (key === ContainerRegistrationKeys.QUERY) return query;
      if (key === ContainerRegistrationKeys.PG_CONNECTION) return buildKnexStub(scenario.sessions);
      throw new Error('Unexpected dependency in DELETE test: ' + key);
    },
  };

  let status = 0;
  let body: any;
  const res: Response = {
    status(code: number) {
      status = code;
      return res;
    },
    json(data: any) {
      body = data;
    },
  };

  await DELETE(
    { params: { id: scenario.siteId }, scope } as any,
    res as any
  );

  return {
    status,
    body,
    graphCalls,
    softDeleteDemoStoresCalled: softDeletedIds.length > 0,
    softDeletedIds,
    softDeleteImportJobsCalls,
  };
}

it('DELETE runs physical teardown and soft-delete when no checkout history exists', async () => {
  const result = await runDelete({
    siteId: 'ds_no_history',
    demo: {
      id: 'ds_no_history',
      is_main: false,
      sales_channel_id: 'sc_1',
      source_type: 'template',
      source_url: null,
    },
    sessions: [],
    orderCartLinks: [],
    orders: [],
  });

  assert.equal(result.status, 200);
  assert.equal(result.body?.deleted, true);
  assert.equal(result.body?.soft_deleted, false);
  assert.equal(result.softDeleteDemoStoresCalled, true);
  assert.deepEqual(result.softDeletedIds, ['ds_no_history']);
  // Import jobs se soft-deletean antes que la fila padre para no dejar huérfanos.
  assert.deepEqual(result.softDeleteImportJobsCalls, [{ demo_store_id: 'ds_no_history' }]);
  // Teardown entered: product lookup happened for the demo's own sales_channel.
  assert.ok(result.graphCalls.some((c) => c.entity === 'product'));
});

it('DELETE skips physical teardown when all associated orders are cancelled', async () => {
  const result = await runDelete({
    siteId: 'ds_all_canceled',
    demo: {
      id: 'ds_all_canceled',
      is_main: false,
      sales_channel_id: 'sc_1',
      source_type: 'template',
      source_url: null,
    },
    sessions: [{ cart_id: 'cart_1' }, { cart_id: 'cart_2' }],
    orderCartLinks: [
      { cart_id: 'cart_1', order_id: 'order_1' },
      { cart_id: 'cart_2', order_id: 'order_2' },
    ],
    orders: [
      { id: 'order_1', display_id: 101, status: 'canceled', canceled_at: null },
      { id: 'order_2', display_id: 102, status: 'pending', canceled_at: '2026-09-01T00:00:00Z' },
    ],
  });

  assert.equal(result.status, 200);
  assert.equal(result.body?.deleted, true);
  assert.equal(result.body?.soft_deleted, true);
  assert.equal(result.softDeleteDemoStoresCalled, true);
  assert.deepEqual(result.softDeletedIds, ['ds_all_canceled']);
  assert.deepEqual(result.softDeleteImportJobsCalls, [{ demo_store_id: 'ds_all_canceled' }]);
  // Teardown skipped: product lookup MUST NOT happen when history is preserved.
  assert.ok(!result.graphCalls.some((c) => c.entity === 'product'));
});

it('DELETE returns 409 with the display_ids of active orders and does not delete', async () => {
  const result = await runDelete({
    siteId: 'ds_active',
    demo: {
      id: 'ds_active',
      is_main: false,
      sales_channel_id: 'sc_1',
      source_type: 'template',
      source_url: null,
    },
    sessions: [{ cart_id: 'cart_1' }, { cart_id: 'cart_2' }],
    orderCartLinks: [
      { cart_id: 'cart_1', order_id: 'order_1' },
      { cart_id: 'cart_2', order_id: 'order_2' },
    ],
    orders: [
      { id: 'order_1', display_id: 201, status: 'pending', canceled_at: null },
      { id: 'order_2', display_id: 202, status: 'canceled', canceled_at: '2026-09-01T00:00:00Z' },
    ],
  });

  assert.equal(result.status, 409);
  assert.match(result.body?.message, /#201/);
  assert.ok(!/#202/.test(result.body?.message));
  assert.match(result.body?.message, /cancelá primero la orden/);
  assert.equal(result.softDeleteDemoStoresCalled, false);
  assert.equal(result.softDeleteImportJobsCalls.length, 0);
  assert.ok(!result.graphCalls.some((c) => c.entity === 'product'));
});

it('DELETE returns a pluralized 409 message when multiple orders are active', async () => {
  const result = await runDelete({
    siteId: 'ds_active_multi',
    demo: {
      id: 'ds_active_multi',
      is_main: false,
      sales_channel_id: 'sc_1',
      source_type: 'template',
      source_url: null,
    },
    sessions: [{ cart_id: 'cart_1' }, { cart_id: 'cart_2' }],
    orderCartLinks: [
      { cart_id: 'cart_1', order_id: 'order_1' },
      { cart_id: 'cart_2', order_id: 'order_2' },
    ],
    orders: [
      { id: 'order_1', display_id: 301, status: 'pending', canceled_at: null },
      { id: 'order_2', display_id: 302, status: 'requires_action', canceled_at: null },
    ],
  });

  assert.equal(result.status, 409);
  assert.match(result.body?.message, /cancelá primero las órdenes/);
  assert.match(result.body?.message, /#301/);
  assert.match(result.body?.message, /#302/);
  assert.equal(result.softDeleteDemoStoresCalled, false);
  assert.equal(result.softDeleteImportJobsCalls.length, 0);
});
