import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Unit-level tests for the sales-channel-rule route logic.
//
// The route handlers are thin: they resolve the pricing module, call
// setPriceListRules / removePriceListRules, and format the response.
// We verify the shape of arguments forwarded to the pricing module and the
// shape of the HTTP response, using in-process mocks.
// ---------------------------------------------------------------------------

const RULE_ATTRIBUTE = 'sales_channel_id';

// ─── Mock factory ─────────────────────────────────────────────────────────────

type PriceListRow = {
  id: string;
  price_list_rules: Array<{ id: string; attribute: string; value: string | string[] }>;
};

function buildPricingMock(overrides: {
  priceLists?: PriceListRow[];
  setPriceListRules?: (data: unknown) => Promise<unknown>;
  removePriceListRules?: (data: unknown) => Promise<unknown>;
} = {}) {
  const priceLists: PriceListRow[] = overrides.priceLists ?? [];

  return {
    listPriceLists: async (
      filter: { id: string[] },
      options: unknown
    ): Promise<PriceListRow[]> => {
      return priceLists.filter((pl) => filter.id.includes(pl.id));
    },
    setPriceListRules: overrides.setPriceListRules ?? (async () => {}),
    removePriceListRules: overrides.removePriceListRules ?? (async () => {}),
  };
}

/** Scope mock capaz de resolver pricing + logger + query.
 *  El route ahora dispara reindex fire-and-forget en POST/DELETE, así que el
 *  scope necesita responder a `LOGGER` y `QUERY` además de `PRICING`. */
function buildScope(pricing: ReturnType<typeof buildPricingMock>) {
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  const query = { graph: async () => ({ data: [] }) };
  return {
    resolve: (key: unknown): unknown => {
      if (typeof key === 'string') {
        if (key === 'logger' || key === 'LOGGER') return logger;
        if (key === 'query' || key === 'QUERY') return query;
      }
      // Modules.PRICING resuelve el pricing mock por default (backwards-compat con
      // los tests originales que llamaban `resolve()` sin argumentos).
      return pricing;
    },
  };
}

type Req = {
  params: { id: string };
  body?: unknown;
  scope: ReturnType<typeof buildScope>;
};

type Res = {
  _status: number;
  _body: unknown;
  status: (code: number) => Res;
  json: (body: unknown) => void;
};

function buildRes(): Res {
  const res: Res = {
    _status: 200,
    _body: undefined,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
    },
  };
  return res;
}

// ─── Import after helpers to avoid module-level side effects ─────────────────

// We import the handlers as functions and call them directly.
// This is possible because the route module exports named async functions.
import { GET, POST, DELETE } from './route.ts';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /admin/price-lists/:id/sales-channel-rule', () => {
  it('returns null rule when price list has no sales_channel_id rule', async () => {
    const pricing = buildPricingMock({
      priceLists: [
        { id: 'prl_01', price_list_rules: [] },
      ],
    });

    const req: Req = {
      params: { id: 'prl_01' },
      scope: buildScope(pricing),
    };
    const res = buildRes();

    await GET(req as any, res as any);

    assert.equal(res._status, 200);
    assert.deepEqual((res._body as any).rule, null);
  });

  it('returns existing rule with channel ids', async () => {
    const pricing = buildPricingMock({
      priceLists: [
        {
          id: 'prl_01',
          price_list_rules: [
            { id: 'plr_01', attribute: RULE_ATTRIBUTE, value: ['sc_a', 'sc_b'] },
          ],
        },
      ],
    });

    const req: Req = {
      params: { id: 'prl_01' },
      scope: buildScope(pricing),
    };
    const res = buildRes();

    await GET(req as any, res as any);

    const rule = (res._body as any).rule;
    assert.equal(rule.attribute, RULE_ATTRIBUTE);
    assert.equal(rule.operator, 'in');
    assert.deepEqual(rule.sales_channel_ids, ['sc_a', 'sc_b']);
  });

  it('returns 404 when price list does not exist', async () => {
    const pricing = buildPricingMock({ priceLists: [] });

    const req: Req = {
      params: { id: 'prl_missing' },
      scope: buildScope(pricing),
    };
    const res = buildRes();

    await GET(req as any, res as any);

    assert.equal(res._status, 404);
  });
});

describe('POST /admin/price-lists/:id/sales-channel-rule', () => {
  it('calls setPriceListRules with the correct payload', async () => {
    let capturedPayload: unknown = null;

    const pricing = buildPricingMock({
      priceLists: [{ id: 'prl_01', price_list_rules: [] }],
      setPriceListRules: async (data) => {
        capturedPayload = data;
      },
    });

    const req: Req = {
      params: { id: 'prl_01' },
      body: { sales_channel_ids: ['sc_x', 'sc_y'] },
      scope: buildScope(pricing),
    };
    const res = buildRes();

    await POST(req as any, res as any);

    assert.deepEqual(capturedPayload, {
      price_list_id: 'prl_01',
      rules: { [RULE_ATTRIBUTE]: ['sc_x', 'sc_y'] },
    });

    const rule = (res._body as any).rule;
    assert.equal(rule.operator, 'in');
    assert.deepEqual(rule.sales_channel_ids, ['sc_x', 'sc_y']);
  });

  it('returns 404 when price list does not exist', async () => {
    const pricing = buildPricingMock({ priceLists: [] });

    const req: Req = {
      params: { id: 'prl_missing' },
      body: { sales_channel_ids: ['sc_x'] },
      scope: buildScope(pricing),
    };
    const res = buildRes();

    await POST(req as any, res as any);

    assert.equal(res._status, 404);
  });

  it('updating with different ids replaces the rule', async () => {
    let lastPayload: any = null;

    const pricing = buildPricingMock({
      priceLists: [
        {
          id: 'prl_01',
          price_list_rules: [
            { id: 'plr_01', attribute: RULE_ATTRIBUTE, value: ['sc_old'] },
          ],
        },
      ],
      setPriceListRules: async (data) => {
        lastPayload = data;
      },
    });

    const req: Req = {
      params: { id: 'prl_01' },
      body: { sales_channel_ids: ['sc_new_a', 'sc_new_b'] },
      scope: buildScope(pricing),
    };
    const res = buildRes();

    await POST(req as any, res as any);

    assert.deepEqual(lastPayload.rules[RULE_ATTRIBUTE], ['sc_new_a', 'sc_new_b']);
    assert.deepEqual((res._body as any).rule.sales_channel_ids, ['sc_new_a', 'sc_new_b']);
  });
});

describe('DELETE /admin/price-lists/:id/sales-channel-rule', () => {
  it('calls removePriceListRules with the correct payload', async () => {
    let capturedPayload: unknown = null;

    const pricing = buildPricingMock({
      priceLists: [{ id: 'prl_01', price_list_rules: [] }],
      removePriceListRules: async (data) => {
        capturedPayload = data;
      },
    });

    const req: Req = {
      params: { id: 'prl_01' },
      scope: buildScope(pricing),
    };
    const res = buildRes();

    await DELETE(req as any, res as any);

    assert.deepEqual(capturedPayload, {
      price_list_id: 'prl_01',
      rules: [RULE_ATTRIBUTE],
    });
    assert.equal((res._body as any).deleted, true);
  });
});
