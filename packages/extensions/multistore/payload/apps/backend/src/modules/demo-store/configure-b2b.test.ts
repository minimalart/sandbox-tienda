import { it } from 'node:test';
import assert from 'node:assert/strict';
import { configureStoreB2B } from './configure-b2b.ts';
import { DEMO_STORE_MODULE } from './index.ts';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
function fixture(overrides: any = {}, owners: any[] = []) {
  let row: any = {
    id: 'site_a',
    name: 'Store A',
    slug: 'a',
    is_main: true,
    b2b_enabled: true,
    sales_channel_id: 'sc_retail',
    region_id: 'reg_a',
    stock_location_id: 'sl_a',
    currency_code: 'ars',
    ...overrides,
  };
  const calls: any[] = [];
  const service = {
    updateDemoStores: async (data: any) => (row = { ...row, ...data }),
    listDemoStores: async () => owners,
  };
  const scope = {
    resolve: (key: string) => {
      if (key === DEMO_STORE_MODULE) return service;
      if (key === Modules.SALES_CHANNEL)
        return { retrieveSalesChannel: async (id: string) => ({ id }) };
      if (key === Modules.PRICING) return { retrievePriceList: async (id: string) => ({ id }) };
      if (key === ContainerRegistrationKeys.QUERY)
        return {
          graph: async () => ({
            data: [{ id: 'sl_linked', sales_channels: [{ id: row.sales_channel_id }] }],
          }),
        };
      throw new Error(key);
    },
  };
  const ops = {
    provision: async (_: any, data: any) => {
      calls.push(data);
      return {
        salesChannelId: data.salesChannelId || 'sc_wholesale',
        customerGroupId: 'cg_a',
        companyId: 'company_a',
        testEmail: null,
        testPassword: null,
      };
    },
    pricing: async (_: any, data: any) => {
      calls.push(data);
      return { priceListId: data.priceListId || 'pl_auto', linkedProducts: 3, tierPrices: 9 };
    },
  };
  return {
    scope,
    ops,
    calls,
    get row() {
      return row;
    },
  };
}
for (const profile of [
  { is_main: true },
  { is_main: false, slug: 'fashion', currency_code: 'usd' },
]) {
  it(
    'completes missing B2B resources and reuses IDs on repeated save: ' + JSON.stringify(profile),
    async () => {
      const f = fixture(profile);
      await configureStoreB2B(f.scope, f.row, {}, f.ops);
      assert.equal(f.row.b2b_enabled, true);
      assert.equal(f.row.b2b_price_list_id, 'pl_auto');
      assert.equal(f.row.sales_channel_id, 'sc_retail');
      assert.equal(f.row.b2b_pricing_tiers.length, 3);
      await configureStoreB2B(f.scope, f.row, {}, f.ops);
      assert.equal(f.calls[2].salesChannelId, 'sc_wholesale');
      assert.equal(f.calls[3].priceListId, 'pl_auto');
    }
  );
}
it('uses selected resources and does not advertise automatic tiers for custom prices', async () => {
  const f = fixture();
  await configureStoreB2B(
    f.scope,
    f.row,
    { b2b_sales_channel_id: 'sc_selected', b2b_price_list_id: 'pl_selected' },
    f.ops
  );
  assert.equal(f.row.b2b_sales_channel_id, 'sc_selected');
  assert.equal(f.row.b2b_price_list_id, 'pl_selected');
  assert.deepEqual(f.row.b2b_pricing_tiers, []);
});
it('rejects another store resource before mutation', async () => {
  const f = fixture({}, [{ id: 'site_b' }]);
  await assert.rejects(
    configureStoreB2B(f.scope, f.row, { b2b_sales_channel_id: 'sc_foreign' }, f.ops),
    /otra tienda/
  );
  assert.equal(f.calls.length, 0);
});
it('resolves the main stock location through its retail channel', async () => {
  const f = fixture({ stock_location_id: null });
  await configureStoreB2B(f.scope, f.row, {}, f.ops);
  assert.equal(f.calls[0].stockLocationId, 'sl_linked');
});
it('keeps partial IDs for retry and does not report B2B ready after pricing failure', async () => {
  const f = fixture();
  await assert.rejects(
    configureStoreB2B(
      f.scope,
      f.row,
      {},
      {
        ...f.ops,
        pricing: async () => {
          throw new Error('pricing unavailable');
        },
      }
    ),
    /pricing unavailable/
  );
  assert.equal(f.row.b2b_enabled, false);
  assert.equal(f.row.b2b_sales_channel_id, 'sc_wholesale');
  await configureStoreB2B(f.scope, f.row, {}, f.ops);
  assert.equal(f.row.b2b_enabled, true);
  assert.equal(f.calls[1].salesChannelId, 'sc_wholesale');
});
