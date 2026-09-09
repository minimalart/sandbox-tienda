import { it } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from './[id]/route.ts';
import { DEMO_STORE_MODULE } from '../../../modules/demo-store/index.ts';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

it('disables B2B without deleting resources or provisioning a submitted selection', async () => {
  let row = { id: 'main', is_main: true, b2b_enabled: true, sales_channel_id: 'retail', b2b_sales_channel_id: 'wholesale', b2b_price_list_id: 'prices' };
  let status = 0;
  const service = {
    retrieveDemoStore: async () => row,
    updateDemoStores: async (data: any) => (row = { ...row, ...data }),
  };
  await POST({
    params: { id: row.id },
    validatedBody: { b2b_enabled: false, b2b_sales_channel_id: null, b2b_price_list_id: null },
    scope: { resolve: (key: string) => {
      if (key === DEMO_STORE_MODULE) return service;
      if (key === ContainerRegistrationKeys.LOGGER) return { error: () => {} };
      throw new Error('Unexpected provisioning dependency: ' + key);
    } },
  } as any, { status: (value: number) => { status = value; return { json: () => {} }; } } as any);
  assert.equal(status, 200);
  assert.equal(row.b2b_enabled, false);
  assert.equal(row.b2b_sales_channel_id, 'wholesale');
  assert.equal(row.b2b_price_list_id, 'prices');
});

it('reports incomplete setup instead of enabling a store without a catalog', async () => {
  let row = { id: 'main', is_main: true, b2b_enabled: false, sales_channel_id: null };
  let status = 0;
  let body: any;
  const service = {
    retrieveDemoStore: async () => row,
    updateDemoStores: async (data: any) => (row = { ...row, ...data }),
  };
  await POST(
    {
      params: { id: row.id },
      validatedBody: { b2b_enabled: true },
      scope: {
        resolve: (key: string) => {
          if (key === DEMO_STORE_MODULE) return service;
          if (key === ContainerRegistrationKeys.LOGGER) return { error: () => {} };
          throw new Error(key);
        },
      },
    } as any,
    {
      status: (code: number) => {
        status = code;
        return {
          json: (data: any) => {
            body = data;
          },
        };
      },
    } as any
  );
  assert.equal(status, 400);
  assert.match(body.message, /canal de catálogo/);
  assert.equal(row.b2b_enabled, false);
});
