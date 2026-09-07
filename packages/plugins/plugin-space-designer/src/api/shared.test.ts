import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adminChannels,
  assertChannel,
  cartContext,
  priceContext,
  publicCatalog,
  storeChannels,
  validateCatalog,
} from './shared';
import type { SpaceConfigV1 } from '../types';

const config: SpaceConfigV1 = {
  version: 1,
  allow_custom: true,
  products: [
    {
      id: 'robot',
      product_id: 'prod_robot',
      variant_id: 'variant_robot',
      category: 'Robótica',
      placement: 'included',
    },
  ],
  templates: [],
};
const request = (rows: unknown[], extras = {}) =>
  ({
    headers: {},
    query: {},
    publishable_key_context: { sales_channel_ids: ['sc_a'] },
    scope: { resolve: () => ({ graph: async () => ({ data: rows }) }) },
    ...extras,
  }) as any;

test('a query parameter cannot expand the sales channels granted by the store key', () => {
  assert.throws(
    () => storeChannels(request([], { query: { sales_channel_id: 'sc_b' } })),
    /no está habilitado/
  );
  assert.deepEqual(storeChannels(request([], { query: { sales_channel_id: 'sc_a' } })), ['sc_a']);
  assert.throws(
    () => storeChannels(request([], { publishable_key_context: { sales_channel_ids: [] } })),
    /canal habilitado/
  );
});
test('a multi-channel key requires an active catalog channel and restricts the response to it', () => {
  const req = request([], {
    publishable_key_context: { sales_channel_ids: ['sc_a', 'sc_b'] },
    query: { sales_channel_id: 'sc_b' },
  });
  assert.deepEqual(storeChannels(req, true), ['sc_b']);
  assert.throws(() => storeChannels({ ...req, query: {} }, true), /canal activo/);
  assert.throws(
    () => storeChannels({ ...req, query: { sales_channel_id: 'sc_c' } }, true),
    /no está habilitado/
  );
});
test('cart mutation rejects another channel and a completed cart', async () => {
  const cart = {
    id: 'cart_a',
    sales_channel_id: 'sc_b',
    region_id: 'reg_a',
    currency_code: 'ars',
    customer_id: null,
    completed_at: null,
  };
  await assert.rejects(cartContext(request([cart]), cart.id), /esta tienda/);
  await assert.rejects(
    cartContext(
      request([{ ...cart, sales_channel_id: 'sc_a', completed_at: '2026-09-04' }]),
      cart.id
    ),
    /esta tienda/
  );
});
test('a customer cart cannot expose group prices to a different customer or a guest', async () => {
  const cart = {
    id: 'cart_a',
    sales_channel_id: 'sc_a',
    region_id: 'reg_a',
    currency_code: 'ars',
    customer_id: 'cus_a',
    completed_at: null,
    customer: { groups: [{ id: 'cg_wholesale' }] },
  };
  await assert.rejects(cartContext(request([cart]), cart.id), /esta tienda/);
  await assert.rejects(
    cartContext(request([cart], { auth_context: { actor_id: 'cus_b' } }), cart.id),
    /esta tienda/
  );
  assert.deepEqual(
    (await cartContext(request([cart], { auth_context: { actor_id: 'cus_a' } }), cart.id))
      .customer_group_ids,
    ['cg_wholesale']
  );
});

test('an expired or foreign optional cart falls back to anonymous regional catalog prices', async () => {
  const req = request([], {
    query: { cart_id: 'cart_stale', region_id: 'reg_a' },
    scope: {
      resolve: () => ({
        graph: async ({ entity }: { entity: string }) => ({
          data: entity === 'region' ? [{ id: 'reg_a', currency_code: 'ars' }] : [],
        }),
      }),
    },
  });
  assert.deepEqual(await priceContext(req), {
    region_id: 'reg_a',
    currency_code: 'ars',
    customer_group_ids: [],
  });
});
test('catalog prices follow the requested region instead of a valid cart from another region', async () => {
  const calls: { entity: string; filters: { id: string } }[] = [];
  const req = request([], {
    query: { cart_id: 'cart_us', region_id: 'reg_ar' },
    auth_context: { actor_id: 'cus_a' },
    scope: {
      resolve: () => ({
        graph: async (query: { entity: string; filters: { id: string } }) => {
          calls.push(query);
          return {
            data:
              query.entity === 'cart'
                ? [
                    {
                      id: 'cart_us',
                      sales_channel_id: 'sc_a',
                      region_id: 'reg_us',
                      currency_code: 'usd',
                      customer_id: 'cus_a',
                      completed_at: null,
                      customer: { groups: [{ id: 'cg_wholesale' }] },
                    },
                  ]
                : query.entity === 'customer'
                  ? [{ id: 'cus_a', groups: [{ id: 'cg_wholesale' }] }]
                  : query.filters.id === 'reg_ar'
                    ? [{ id: 'reg_ar', currency_code: 'ars' }]
                    : [],
          };
        },
      }),
    },
  });
  assert.deepEqual(await priceContext(req), {
    region_id: 'reg_ar',
    currency_code: 'ars',
    customer_group_ids: ['cg_wholesale'],
  });
  assert.ok(calls.some((query) => query.entity === 'region' && query.filters.id === 'reg_ar'));
  await assert.rejects(
    priceContext({ ...req, query: { cart_id: 'cart_us', region_id: 'reg_missing' } }),
    /región elegida no existe/
  );
  await assert.rejects(
    priceContext({ ...req, query: { cart_id: 'cart_us', region_id: ['reg_ar'] } }),
    /región elegida no es válida/
  );
});
test('an authenticated customer gets current group prices before creating or transferring a cart', async () => {
  const queries: { entity: string; filters: { id: string } }[] = [];
  const req = request([], {
    query: { region_id: 'reg_ar', customer_id: 'cus_other', customer_group_ids: ['cg_forged'] },
    auth_context: { actor_id: 'cus_a' },
    scope: {
      resolve: () => ({
        graph: async (query: { entity: string; filters: { id: string } }) => {
          queries.push(query);
          return {
            data:
              query.entity === 'customer'
                ? [{ id: 'cus_a', groups: [{ id: 'cg_current' }] }]
                : query.entity === 'cart'
                  ? [
                      {
                        id: 'cart_guest',
                        sales_channel_id: 'sc_a',
                        region_id: 'reg_ar',
                        currency_code: 'ars',
                        customer_id: null,
                        completed_at: null,
                      },
                    ]
                  : [{ id: 'reg_ar', currency_code: 'ars' }],
          };
        },
      }),
    },
  });
  assert.deepEqual(await priceContext(req), {
    region_id: 'reg_ar',
    currency_code: 'ars',
    customer_group_ids: ['cg_current'],
  });
  assert.deepEqual(
    (await priceContext({ ...req, query: { ...req.query, cart_id: 'cart_guest' } }))
      ?.customer_group_ids,
    ['cg_current']
  );
  assert.ok(
    queries
      .filter((query) => query.entity === 'customer')
      .every((query) => query.filters.id === 'cus_a')
  );
  assert.deepEqual(
    (await priceContext({ ...req, auth_context: undefined }))?.customer_group_ids,
    []
  );
});
test('catalog publication validates variant ownership, publication and channel membership', async () => {
  const variant = {
    id: 'variant_robot',
    product: { id: 'prod_robot', status: 'published', sales_channels: [{ id: 'sc_a' }] },
  };
  await validateCatalog(request([variant]), config, 'sc_a', true);
  await assert.rejects(
    validateCatalog(
      request([{ ...variant, product: { ...variant.product, id: 'prod_other' } }]),
      config,
      'sc_a',
      true
    ),
    /no pertenece al producto/
  );
  await assert.rejects(validateCatalog(request([variant]), config, 'sc_b', true), /canal/);
  await assert.rejects(
    validateCatalog(
      request([{ ...variant, product: { ...variant.product, status: 'draft' } }]),
      config,
      'sc_a',
      true
    ),
    /Publicá/
  );
});
test('public catalog excludes cross-channel and unpublished variants, and preserves current native prices', async () => {
  const valid = {
    id: 'variant_robot',
    title: 'Kit',
    manage_inventory: false,
    product: {
      id: 'prod_robot',
      title: 'Robot',
      status: 'published',
      sales_channels: [{ id: 'sc_a' }],
    },
    calculated_price: { calculated_amount: 75000, currency_code: 'ars' },
  };
  const otherChannel = {
    ...valid,
    id: 'variant_other',
    product: { ...valid.product, id: 'prod_other', sales_channels: [{ id: 'sc_b' }] },
  };
  const draft = {
    ...valid,
    id: 'variant_draft',
    product: { ...valid.product, id: 'prod_draft', status: 'draft' },
  };
  const catalog = await publicCatalog(request([valid, otherChannel, draft]), config);
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]!.variants[0]!.calculated_amount, 75000);
});
test('an admin selected site rejects an unknown site and cross-channel mutations', async () => {
  const req = request([], {
    headers: { 'x-site-id': 'site_missing' },
    scope: { resolve: () => ({ listDemoStores: async () => [] }) },
  });
  await assert.rejects(adminChannels(req), /esta tienda/);
  assert.throws(() => assertChannel('sc_b', ['sc_a'], false), /esta tienda/);
  assert.throws(() => assertChannel(null, ['sc_a'], false), /esta tienda/);
  assert.doesNotThrow(() => assertChannel(null, null, false));
});
