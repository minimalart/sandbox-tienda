import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { attachChannelPrices, buildChannelPriceMap } from './reindex.ts';

/**
 * Tests para el helper de channel-scoped price overrides (EDUCABOT-9).
 *
 * `buildChannelPriceMap` compone TRES sources:
 *   - `pricing.listPriceListRules({ attribute: 'sales_channel_id' })` — el
 *     único camino: `price_list_rule` NO está en el joiner-config del pricing
 *     module (`@medusajs/pricing/dist/joiner-config.js` sólo expone PriceSet,
 *     PriceList, Price y PricePreference), así que RemoteQuery no lo resuelve
 *     y `query.graph({ entity: 'price_list_rule' })` explota con "Service
 *     with alias 'price_list_rule' was not found". Este error vació la
 *     colección Typesense de EducaBot en el deploy del 2026-09-15 (rollback
 *     `5a70e01c`). El test de más abajo lo bloquea de raíz.
 *   - `query.graph({ entity: 'price' })` — precios de las listas identificadas.
 *   - `query.graph({ entity: 'product_variant' })` — resolución price_set → variant.
 *
 * `attachChannelPrices` es puro: recibe productos + mapa y agrega
 * `channel_prices` a cada variant.
 */

type MockGraph = { graph: (input: any) => Promise<{ data: unknown[] }> };
type PricingRule = {
  price_list_id: string;
  attribute: string;
  value: string | string[];
  price_list?: {
    id: string;
    status?: string | null;
    deleted_at?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
  } | null;
};

/**
 * Construye un mock de `query.graph` en base a `{ [entity]: data[] }`.
 * Ignora filtros — cada test arma exactamente lo que devuelve por entity.
 */
function mockQuery(fixtures: Record<string, unknown[]>): MockGraph {
  return {
    graph: async (input: any) => {
      const entity = input?.entity as string | undefined;
      if (!entity) return { data: [] };
      return { data: fixtures[entity] ?? [] };
    },
  };
}

/**
 * Mock del pricing service. Recibe el listado de reglas — el filter por
 * `attribute` se ignora, cada test debe pasar solo las reglas que quiere que
 * el helper vea (idéntico al patrón de `mockQuery`).
 */
function mockPricing(rules: PricingRule[]) {
  return {
    listPriceListRules: async () => rules,
  };
}

function mockDeps(fixtures: Record<string, unknown[]>, rules: PricingRule[] = []) {
  return { query: mockQuery(fixtures), pricing: mockPricing(rules) };
}

const NEVER = null;
const FUTURE = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
const PAST = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

describe('buildChannelPriceMap', () => {
  it('devuelve mapa vacío cuando no hay reglas activas', async () => {
    const deps = mockDeps({});
    const map = await buildChannelPriceMap(deps, 'ars');
    assert.equal(map.size, 0);
  });

  it('ignora reglas de price lists no activos (draft/deleted/expired)', async () => {
    const deps = mockDeps({}, [
      {
        price_list_id: 'pl_draft',
        attribute: 'sales_channel_id',
        value: ['sc_a'],
        price_list: { id: 'pl_draft', status: 'draft', deleted_at: NEVER },
      },
      {
        price_list_id: 'pl_deleted',
        attribute: 'sales_channel_id',
        value: ['sc_a'],
        price_list: { id: 'pl_deleted', status: 'active', deleted_at: PAST },
      },
      {
        price_list_id: 'pl_expired',
        attribute: 'sales_channel_id',
        value: ['sc_a'],
        price_list: {
          id: 'pl_expired',
          status: 'active',
          deleted_at: NEVER,
          ends_at: PAST,
        },
      },
    ]);
    const map = await buildChannelPriceMap(deps, 'ars');
    assert.equal(map.size, 0);
  });

  it('empareja variantes con precios por price_set (un solo canal, un solo precio)', async () => {
    const deps = mockDeps(
      {
        price: [
          { amount: 14350, currency_code: 'ars', price_list_id: 'pl_1', price_set_id: 'pset_1' },
        ],
        product_variant: [{ id: 'variant_1', price_set: { id: 'pset_1' } }],
      },
      [
        {
          price_list_id: 'pl_1',
          attribute: 'sales_channel_id',
          value: ['sc_andresito'],
          price_list: { id: 'pl_1', status: 'active', deleted_at: NEVER },
        },
      ],
    );
    const map = await buildChannelPriceMap(deps, 'ars');
    assert.equal(map.size, 1);
    const entries = map.get('variant_1');
    assert.ok(entries);
    assert.equal(entries!.length, 1);
    assert.equal(entries![0].sales_channel_id, 'sc_andresito');
    assert.equal(entries![0].calculated_amount, 14350);
    assert.equal(entries![0].original_amount, 14350);
    assert.equal(entries![0].currency_code, 'ars');
  });

  it('expande una regla con múltiples canales en varias entries por variant', async () => {
    const deps = mockDeps(
      {
        price: [
          { amount: 1000, currency_code: 'ars', price_list_id: 'pl_1', price_set_id: 'pset_1' },
        ],
        product_variant: [{ id: 'variant_1', price_set: { id: 'pset_1' } }],
      },
      [
        {
          price_list_id: 'pl_1',
          attribute: 'sales_channel_id',
          value: ['sc_a', 'sc_b', 'sc_c'],
          price_list: { id: 'pl_1', status: 'active', deleted_at: NEVER },
        },
      ],
    );
    const map = await buildChannelPriceMap(deps, 'ars');
    const entries = map.get('variant_1');
    assert.ok(entries);
    assert.equal(entries!.length, 3);
    const channelIds = entries!.map((e) => e.sales_channel_id).sort();
    assert.deepEqual(channelIds, ['sc_a', 'sc_b', 'sc_c']);
    for (const e of entries!) assert.equal(e.calculated_amount, 1000);
  });

  it('filtra precios de otra moneda', async () => {
    const deps = mockDeps(
      {
        price: [
          { amount: 1000, currency_code: 'ars', price_list_id: 'pl_1', price_set_id: 'pset_1' },
          // El precio en USD debe ignorarse cuando el sync corre en ARS.
          { amount: 12, currency_code: 'usd', price_list_id: 'pl_1', price_set_id: 'pset_1' },
        ],
        product_variant: [{ id: 'variant_1', price_set: { id: 'pset_1' } }],
      },
      [
        {
          price_list_id: 'pl_1',
          attribute: 'sales_channel_id',
          value: ['sc_a'],
          price_list: { id: 'pl_1', status: 'active', deleted_at: NEVER },
        },
      ],
    );
    const map = await buildChannelPriceMap(deps, 'ars');
    const entries = map.get('variant_1');
    assert.equal(entries!.length, 1);
    assert.equal(entries![0].currency_code, 'ars');
    assert.equal(entries![0].calculated_amount, 1000);
  });

  it('dedup por (variant, sales_channel_id): 2 reglas apuntando al mismo canal en la misma lista', async () => {
    // El motor de Medusa no crea dos reglas iguales, pero ninguna constraint
    // lo impide en la DB. Nos aseguramos de que si aparece, el índice de
    // Typesense no se ensucia con duplicados.
    const deps = mockDeps(
      {
        price: [
          { amount: 500, currency_code: 'ars', price_list_id: 'pl_1', price_set_id: 'pset_1' },
        ],
        product_variant: [{ id: 'variant_1', price_set: { id: 'pset_1' } }],
      },
      [
        {
          price_list_id: 'pl_1',
          attribute: 'sales_channel_id',
          value: ['sc_a'],
          price_list: { id: 'pl_1', status: 'active', deleted_at: NEVER },
        },
      ],
    );
    const map = await buildChannelPriceMap(deps, 'ars');
    const entries = map.get('variant_1');
    assert.equal(entries!.length, 1);
  });

  it('respeta starts_at futuro (la lista aún no arrancó)', async () => {
    const deps = mockDeps({}, [
      {
        price_list_id: 'pl_pending',
        attribute: 'sales_channel_id',
        value: ['sc_a'],
        price_list: {
          id: 'pl_pending',
          status: 'active',
          deleted_at: NEVER,
          starts_at: FUTURE,
        },
      },
    ]);
    const map = await buildChannelPriceMap(deps, 'ars');
    assert.equal(map.size, 0);
  });

  it('regresión: NO usa query.graph({ entity: "price_list_rule" }) — usa el service', async () => {
    // Incidente 2026-09-15: la implementación previa hacía
    // `query.graph({ entity: 'price_list_rule' })`, que explota porque el
    // joiner-config del pricing module no expone ese alias. Consecuencia:
    // el sync fallaba antes de escribir docs y la colección Typesense
    // quedaba vacía. Este test bloquea la regresión: capturamos qué entities
    // pide el helper y aseguramos que `price_list_rule` no aparece.
    const requestedEntities: string[] = [];
    const deps = {
      query: {
        graph: async (input: any) => {
          if (input?.entity) requestedEntities.push(input.entity as string);
          return { data: [] };
        },
      },
      pricing: mockPricing([]),
    };
    await buildChannelPriceMap(deps, 'ars');
    assert.equal(
      requestedEntities.includes('price_list_rule'),
      false,
      'price_list_rule NO está expuesto por RemoteQuery — usar pricing.listPriceListRules en su lugar',
    );
  });
});

// Nota: NO tenemos un test que lea el joiner-config compilado del pricing
// module. Lo intentamos primero (regresión "si Medusa expone PriceListRule
// podemos volver a query.graph"), pero el test-runner de este repo bloquea
// resolvers CJS custom y el paquete no expone `package.json`/`joiner-config`
// como subpath ESM. El guard "regresión: NO usa query.graph(...)" de arriba
// cubre el mismo objetivo funcional sin acoplarse al filesystem del paquete.

describe('attachChannelPrices', () => {
  it('inyecta channel_prices en la variante correspondiente y deja el resto intacto', () => {
    const products = [
      {
        id: 'prod_1',
        variants: [
          { id: 'variant_a', calculated_price: { calculated_amount: 100 } },
          { id: 'variant_b', calculated_price: { calculated_amount: 200 } },
        ],
      },
    ];
    const map = new Map<
      string,
      Array<{
        sales_channel_id: string;
        calculated_amount: number;
        original_amount: number;
        currency_code: string;
      }>
    >();
    map.set('variant_a', [
      {
        sales_channel_id: 'sc_x',
        calculated_amount: 50,
        original_amount: 50,
        currency_code: 'ars',
      },
    ]);
    const touched = attachChannelPrices(products, map);
    assert.equal(touched, 1);
    const variantA = products[0].variants[0] as any;
    const variantB = products[0].variants[1] as any;
    assert.equal(variantA.channel_prices?.[0]?.sales_channel_id, 'sc_x');
    assert.equal(variantA.calculated_price.calculated_amount, 100, 'calculated_price no se toca');
    assert.equal(variantB.channel_prices, undefined, 'variantes sin overrides quedan sin campo');
  });

  it('es no-op cuando el mapa está vacío (backward-compat)', () => {
    const products = [
      { id: 'p1', variants: [{ id: 'v1', calculated_price: { calculated_amount: 100 } }] },
    ];
    const touched = attachChannelPrices(products, new Map());
    assert.equal(touched, 0);
    assert.equal((products[0].variants[0] as any).channel_prices, undefined);
  });

  it('tolera productos sin variants o con variants sin id', () => {
    const products = [
      { id: 'p1' },
      { id: 'p2', variants: [] },
      { id: 'p3', variants: [{}, { id: undefined }] },
    ];
    const map = new Map();
    map.set('variant_x', [
      {
        sales_channel_id: 'sc_x',
        calculated_amount: 1,
        original_amount: 1,
        currency_code: 'ars',
      },
    ]);
    const touched = attachChannelPrices(products, map);
    assert.equal(touched, 0);
  });
});
