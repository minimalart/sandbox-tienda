import { it } from 'node:test';
import assert from 'node:assert/strict';
import { provisionDemoB2BPricing } from './b2b-pricing.ts';
import {
  ContainerRegistrationKeys,
  Modules,
  createMedusaContainer,
} from '@medusajs/framework/utils';
import { asValue } from '@medusajs/framework/awilix';
const input = {
  demoSlug: 'empty',
  sourceSalesChannelId: 'sc_retail',
  b2bSalesChannelId: 'sc_wholesale',
  customerGroupId: 'cg_own',
  currencyCode: 'ars',
};
it('does not narrow an unrestricted existing list to wholesale buyers', async () => {
  const scope = { resolve(key: string) {
    if (key === ContainerRegistrationKeys.LOGGER) return { info() {} };
    if (key === ContainerRegistrationKeys.QUERY) return { graph: async () => ({ data: [] }) };
    if (key === Modules.PRICING) return {
      retrievePriceList: async () => ({ price_list_rules: [] }),
      setPriceListRules: async () => assert.fail('Public prices must remain available to retail buyers'),
    };
    throw new Error(key);
  } };
  assert.equal((await provisionDemoB2BPricing(scope, { ...input, priceListId: 'pl_public' })).priceListId, 'pl_public');
});
it('creates the price list even with an empty catalog through the Medusa workflow', async () => {
  const scope = createMedusaContainer();
  let created: any[] = [];
  scope.register({
    [ContainerRegistrationKeys.LOGGER]: asValue({ info() {}, warn() {}, error() {} }),
    [ContainerRegistrationKeys.QUERY]: asValue({ graph: async () => ({ data: [] }) }),
    [ContainerRegistrationKeys.REMOTE_QUERY]: asValue(async () => []),
    [Modules.PRICING]: asValue({
      listPriceLists: async () => [],
      createPriceLists: async (data: any[]) => {
        created = data;
        return [{ id: 'pl_empty', ...data[0] }];
      },
    }),
  });
  const result = await provisionDemoB2BPricing(scope, input);
  assert.equal(result.priceListId, 'pl_empty');
  assert.deepEqual(created[0].prices, []);
  assert.deepEqual(created[0].rules, { 'customer.groups.id': ['cg_own'] });
});
it('retains existing prices and all existing audience rules on repeated association', async () => {
  let rules: any = { 'customer.groups.id': ['cg_existing'], region_id: ['reg_a'] };
  const scope = {
    resolve(key: string) {
      if (key === ContainerRegistrationKeys.LOGGER) return { info() {} };
      if (key === ContainerRegistrationKeys.QUERY) return { graph: async () => ({ data: [] }) };
      if (key === Modules.PRICING)
        return {
          retrievePriceList: async () => ({
            price_list_rules: Object.entries(rules).map(([attribute, value]) => ({
              attribute,
              value,
            })),
          }),
          setPriceListRules: async (data: any) => {
            rules = data.rules;
          },
          deletePriceLists: async () => assert.fail('Existing prices must not be deleted'),
          createPriceLists: async () => assert.fail('Existing prices must not be replaced'),
        };
      throw new Error(key);
    },
  };
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await provisionDemoB2BPricing(scope, { ...input, priceListId: 'pl_selected' })).priceListId,
      'pl_selected'
    );
  assert.deepEqual(rules, {
    'customer.groups.id': ['cg_existing', 'cg_own'],
    region_id: ['reg_a'],
  });
});
