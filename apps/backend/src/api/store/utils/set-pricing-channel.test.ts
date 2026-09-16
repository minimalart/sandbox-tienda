import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setPricingChannel } from './set-pricing-channel.ts';

/**
 * Priority under test:
 *   1. `filterableFields.sales_channel_id` / `query.sales_channel_id`
 *   2. Cart's own `sales_channel_id` (for cart line-item endpoints)
 *   3. Publishable key — ONLY when it exposes a single channel
 *
 * With multiple channels on the key and no explicit signal, the middleware
 * intentionally does NOT inject (base price fallback preserves R2).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Req = {
  pricingContext?: Record<string, unknown>;
  publishable_key_context?: { sales_channel_ids?: string[] };
  filterableFields?: { sales_channel_id?: string | string[] };
  query?: { sales_channel_id?: string | string[] };
  params?: Record<string, string>;
  scope: {
    resolve: (key: string) => unknown;
  };
};

function buildReq(overrides: Partial<Req> = {}): Req {
  return {
    pricingContext: { region_id: 'reg_01', currency_code: 'ars' },
    scope: {
      resolve: () => ({
        graph: async () => ({ data: [] }),
      }),
    },
    ...overrides,
  };
}

async function run(req: Req): Promise<void> {
  const mw = setPricingChannel();
  let nextCalled = false;
  await mw(
    req as unknown as Parameters<typeof mw>[0],
    {} as Parameters<typeof mw>[1],
    () => { nextCalled = true; }
  );
  assert.ok(nextCalled, 'next() should be called');
}

// ---------------------------------------------------------------------------
// Path 1 — explicit signal (filterableFields / query)
// ---------------------------------------------------------------------------

describe('setPricingChannel — Path 1 (explicit signal)', () => {
  it('reads sales_channel_id from filterableFields (string)', async () => {
    const req = buildReq({
      filterableFields: { sales_channel_id: 'sc_from_filters' },
      publishable_key_context: { sales_channel_ids: ['sc_key_a', 'sc_key_b'] },
    });
    await run(req);
    assert.equal(req.pricingContext?.sales_channel_id, 'sc_from_filters');
  });

  it('reads sales_channel_id from filterableFields (array — takes first)', async () => {
    const req = buildReq({
      filterableFields: { sales_channel_id: ['sc_first', 'sc_second'] },
    });
    await run(req);
    assert.equal(req.pricingContext?.sales_channel_id, 'sc_first');
  });

  it('falls back to query.sales_channel_id when filterableFields absent', async () => {
    const req = buildReq({
      query: { sales_channel_id: 'sc_from_query' },
    });
    await run(req);
    assert.equal(req.pricingContext?.sales_channel_id, 'sc_from_query');
  });

  it('filterableFields wins over query when both present', async () => {
    const req = buildReq({
      filterableFields: { sales_channel_id: 'sc_filter' },
      query: { sales_channel_id: 'sc_query' },
    });
    await run(req);
    assert.equal(req.pricingContext?.sales_channel_id, 'sc_filter');
  });

  it('explicit signal wins over publishable key even if key has one channel', async () => {
    const req = buildReq({
      filterableFields: { sales_channel_id: 'sc_explicit' },
      publishable_key_context: { sales_channel_ids: ['sc_key_only'] },
    });
    await run(req);
    assert.equal(req.pricingContext?.sales_channel_id, 'sc_explicit');
  });
});

// ---------------------------------------------------------------------------
// Path 2 — cart
// ---------------------------------------------------------------------------

describe('setPricingChannel — Path 2 (cart lookup)', () => {
  it('reads sales_channel_id from the cart when params.id starts with cart_', async () => {
    const req = buildReq({
      params: { id: 'cart_01ABC' },
      scope: {
        resolve: () => ({
          graph: async () => ({
            data: [{ id: 'cart_01ABC', sales_channel_id: 'sc_from_cart' }],
          }),
        }),
      },
    });
    await run(req);
    assert.equal(req.pricingContext?.sales_channel_id, 'sc_from_cart');
  });

  it('does NOT query cart when params.id does not start with cart_', async () => {
    let graphCalled = false;
    const req = buildReq({
      params: { id: 'order_01' },
      scope: {
        resolve: () => ({
          graph: async () => {
            graphCalled = true;
            return { data: [] };
          },
        }),
      },
    });
    await run(req);
    assert.equal(graphCalled, false);
    assert.equal(req.pricingContext?.sales_channel_id, undefined);
  });

  it('explicit signal (Path 1) wins over cart lookup', async () => {
    const req = buildReq({
      filterableFields: { sales_channel_id: 'sc_explicit' },
      params: { id: 'cart_01ABC' },
      scope: {
        resolve: () => ({
          graph: async () => ({
            data: [{ id: 'cart_01ABC', sales_channel_id: 'sc_from_cart' }],
          }),
        }),
      },
    });
    await run(req);
    assert.equal(req.pricingContext?.sales_channel_id, 'sc_explicit');
  });
});

// ---------------------------------------------------------------------------
// Path 3 — publishable key with single channel
// ---------------------------------------------------------------------------

describe('setPricingChannel — Path 3 (single-channel publishable key)', () => {
  it('uses the single channel when key has exactly one', async () => {
    const req = buildReq({
      publishable_key_context: { sales_channel_ids: ['sc_only'] },
    });
    await run(req);
    assert.equal(req.pricingContext?.sales_channel_id, 'sc_only');
  });

  it('does NOT inject when key has multiple channels and no explicit signal', async () => {
    // Este es el cambio de comportamiento clave: antes tomabamos channelIds[0]
    // arbitrariamente; ahora no adivinamos y dejamos que caiga al base price.
    const req = buildReq({
      publishable_key_context: { sales_channel_ids: ['sc_a', 'sc_b', 'sc_c'] },
    });
    await run(req);
    assert.equal(req.pricingContext?.sales_channel_id, undefined);
  });

  it('does NOT inject when key has an empty channel array', async () => {
    const req = buildReq({
      publishable_key_context: { sales_channel_ids: [] },
    });
    await run(req);
    assert.equal(req.pricingContext?.sales_channel_id, undefined);
  });
});

// ---------------------------------------------------------------------------
// Fail-open + edge cases
// ---------------------------------------------------------------------------

describe('setPricingChannel — fail-open', () => {
  it('does not throw when pricingContext is not yet set', async () => {
    const req = buildReq({ pricingContext: undefined });
    await run(req);
  });

  it('does not throw when the cart graph query fails', async () => {
    const req = buildReq({
      params: { id: 'cart_broken' },
      scope: {
        resolve: () => ({
          graph: async () => { throw new Error('DB error'); },
        }),
      },
    });
    await run(req);
    assert.equal(req.pricingContext?.sales_channel_id, undefined);
  });

  it('ignores empty strings in filterableFields', async () => {
    const req = buildReq({
      filterableFields: { sales_channel_id: '' },
      publishable_key_context: { sales_channel_ids: ['sc_key_only'] },
    });
    await run(req);
    // Cae a Path 3 (key single-channel) porque el string vacío no cuenta como señal.
    assert.equal(req.pricingContext?.sales_channel_id, 'sc_key_only');
  });
});
