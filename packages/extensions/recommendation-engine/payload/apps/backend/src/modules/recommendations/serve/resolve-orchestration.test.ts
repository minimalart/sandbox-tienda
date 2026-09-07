import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { RECOMMENDATION_ENGINE_MODULE } from '..';
import { STORE_CONFIG_MODULE } from '../../store-config';
import { RECOMMENDATIONS_SETTING_KEY } from '../config';
import { invalidateAll } from './cache';
import { resetBrandProbe } from './hydrate';
import { resolveRecommendations } from './resolve';

/**
 * Orquestación del serve path con un container falso.
 *
 * No reemplaza a la verificación contra Postgres (el SQL de candidatos y la
 * hidratación real siguen sin probarse acá), pero sí cubre todo el cableado que de
 * otro modo se descubre recién en runtime: qué tiers se piden, cuándo se usa el
 * sentinela global, el camino de vistos recientemente, la banda de bridge, y que
 * ningún dato faltante haga lanzar en lugar de devolver vacío.
 */

type Row = Record<string, unknown>;

const placement = (overrides: Row = {}): Row => ({
  key: 'product-detail-complementary',
  enabled: true,
  strategy_key: 'manual',
  fallback_chain: null,
  result_limit: 8,
  candidate_limit: 30,
  filters: null,
  relation_types: null,
  sales_channel_id: null,
  ...overrides,
});

const strategy = (key: string, kind: string, overrides: Row = {}): Row => ({
  key,
  kind,
  enabled: true,
  fallback_chain: null,
  config: null,
  sales_channel_id: null,
  ...overrides,
});

const candidateRow = (id: string, strategyKey: string, overrides: Row = {}): Row => ({
  target_product_id: id,
  strategy_key: strategyKey,
  relation_type: 'complementary',
  priority: 0,
  score: 0,
  confidence: null,
  co_occurrences: null,
  version_id: null,
  ...overrides,
});

const graphProduct = (id: string, overrides: Row = {}): Row => ({
  id,
  title: `Producto ${id}`,
  handle: id,
  thumbnail: null,
  status: 'published',
  collection_id: null,
  type_id: null,
  metadata: null,
  categories: [],
  tags: [],
  sales_channels: [{ id: 'sc_main' }],
  variants: [
    {
      id: `${id}_v1`,
      sku: `SKU-${id}`,
      title: 'Default',
      manage_inventory: true,
      calculated_price: { calculated_amount: 1000, original_amount: 1000, currency_code: 'ars' },
      inventory_items: [{ inventory: { location_levels: [{ available_quantity: 5 }] } }],
    },
  ],
  ...overrides,
});

type HarnessOptions = {
  config?: Row | null;
  placements?: Row[];
  strategies?: Row[];
  versions?: Row[];
  candidates?: Row[];
  products?: Row[];
  cart?: Row | null;
  region?: Row | null;
};

/** Container falso con todo lo que resolve.ts resuelve. */
function harness(options: HarnessOptions = {}) {
  const knexCalls: Array<{ sql: string; bindings: unknown[] }> = [];
  const graphCalls: Row[] = [];

  const service = {
    listRecommendationPlacements: async () => options.placements ?? [placement()],
    listRecommendationStrategies: async () =>
      options.strategies ?? [strategy('manual', 'manual'), strategy('popular', 'popular')],
    listRecommendationVersions: async () => options.versions ?? [],
  };

  const storeConfig = {
    // `readSetting`, no `listStoreSettings`: desde que `store_setting` tiene `site_id`
    // el listado puede devolver dos filas y quedarse con la primera es indefinido.
    readSetting: async (key: string) =>
      key === RECOMMENDATIONS_SETTING_KEY && options.config ? { value: options.config } : undefined,
  };

  const query = {
    graph: async (config: Row) => {
      graphCalls.push(config);
      if (config.entity === 'cart') return { data: options.cart ? [options.cart] : [] };
      if (config.entity === 'region') return { data: options.region ? [options.region] : [] };
      return { data: options.products ?? [] };
    },
  };

  const knex = {
    raw: async (sql: string, bindings: unknown[] = []) => {
      knexCalls.push({ sql, bindings });
      return { rows: options.candidates ?? [] };
    },
  };

  const container = {
    resolve: (key: string) => {
      if (key === RECOMMENDATION_ENGINE_MODULE) return service;
      if (key === STORE_CONFIG_MODULE) return storeConfig;
      if (key === ContainerRegistrationKeys.QUERY) return query;
      if (key === ContainerRegistrationKeys.PG_CONNECTION) return knex;
      throw new Error(`unexpected resolve(${key})`);
    },
  } as unknown as MedusaContainer;

  return { container, knexCalls, graphCalls };
}

const lastCandidateQuery = (calls: Array<{ sql: string; bindings: unknown[] }>) => calls.at(-1);

/**
 * Cuenta los eslabones pedidos. No se puede partir el SQL por ` or ` porque el WHERE
 * también lo usa para vigencia y canal: se cuentan las cláusulas de estrategia.
 */
const tierCount = (sql: string): number => (sql.match(/r\.strategy_key = \?/g) ?? []).length;

beforeEach(() => {
  invalidateAll();
  resetBrandProbe();
  delete process.env.RECOMMENDATIONS_ENABLED;
});

describe('resolveRecommendations — cortes tempranos', () => {
  it('el kill switch de env corta antes de tocar la base', async () => {
    // Es la vía de escape cuando la base ES el problema: no puede depender de leerla.
    process.env.RECOMMENDATIONS_ENABLED = 'false';
    const { container, knexCalls, graphCalls } = harness();
    const result = await resolveRecommendations(container, { placement: 'product-detail-complementary' });
    assert.deepEqual(result.products, []);
    assert.equal(knexCalls.length, 0);
    assert.equal(graphCalls.length, 0);
    assert.ok(result.request_id.startsWith('recq_'));
  });

  it('el toggle de configuración apaga el motor', async () => {
    const { container, knexCalls } = harness({ config: { enabled: false } });
    const result = await resolveRecommendations(container, { placement: 'product-detail-complementary' });
    assert.deepEqual(result.products, []);
    assert.equal(knexCalls.length, 0);
  });

  it('un placement desconocido devuelve vacío sin lanzar', async () => {
    const { container, knexCalls } = harness();
    const result = await resolveRecommendations(container, { placement: 'no-existe' });
    assert.deepEqual(result.products, []);
    assert.equal(result.placement, 'no-existe');
    assert.equal(knexCalls.length, 0);
  });

  it('un placement deshabilitado devuelve vacío', async () => {
    const { container } = harness({ placements: [placement({ enabled: false })] });
    const result = await resolveRecommendations(container, { placement: 'product-detail-complementary' });
    assert.deepEqual(result.products, []);
  });

  it('un placement acotado a otro canal no responde', async () => {
    const { container } = harness({ placements: [placement({ sales_channel_id: 'sc_demo' })] });
    const result = await resolveRecommendations(container, {
      placement: 'product-detail-complementary',
      sales_channel_id: 'sc_main',
    });
    assert.deepEqual(result.products, []);
  });
});

describe('resolveRecommendations — camino feliz con relaciones manuales', () => {
  it('devuelve los productos elegibles con su posición', async () => {
    const { container } = harness({
      candidates: [candidateRow('prod_a', 'manual'), candidateRow('prod_b', 'manual')],
      products: [graphProduct('prod_a'), graphProduct('prod_b')],
    });
    const result = await resolveRecommendations(container, {
      placement: 'product-detail-complementary',
      product_id: 'prod_source',
      sales_channel_id: 'sc_main',
      region_id: 'reg_1',
    });
    assert.equal(result.resolved_strategy_key, 'manual');
    assert.equal(result.fallback_used, false);
    assert.deepEqual(
      result.products.map((p) => p.product_id),
      ['prod_a', 'prod_b'],
    );
    assert.deepEqual(
      result.products.map((p) => p.position),
      [0, 1],
    );
    assert.equal(result.products[0]?.price, 1000);
  });

  it('hidrata el producto de origen en el MISMO batch que los candidatos', async () => {
    // Es lo que hace que los filtros de misma-categoría / misma-marca cuesten cero
    // round trips extra.
    const { container, graphCalls } = harness({
      candidates: [candidateRow('prod_a', 'manual')],
      products: [graphProduct('prod_a'), graphProduct('prod_source')],
    });
    await resolveRecommendations(container, {
      placement: 'product-detail-complementary',
      product_id: 'prod_source',
      region_id: 'reg_1',
    });
    const productCall = graphCalls.find((c) => c.entity === 'product');
    assert.deepEqual((productCall?.filters as Row)?.id, ['prod_a', 'prod_source']);
  });

  it('respeta tres round trips: candidatos, carrito e hidratación', async () => {
    const { container, knexCalls, graphCalls } = harness({
      cart: { id: 'cart_1', currency_code: 'ars', region_id: 'reg_1', sales_channel_id: 'sc_main', items: [] },
      candidates: [candidateRow('prod_a', 'manual')],
      products: [graphProduct('prod_a')],
    });
    await resolveRecommendations(container, {
      placement: 'product-detail-complementary',
      product_id: 'prod_source',
      cart_id: 'cart_1',
    });
    assert.equal(knexCalls.length, 1);
    assert.equal(graphCalls.length, 2); // cart + product
  });

  it('excluye lo que ya está en el carrito y hereda su contexto', async () => {
    const { container } = harness({
      cart: {
        id: 'cart_1',
        currency_code: 'ars',
        region_id: 'reg_1',
        sales_channel_id: 'sc_main',
        items: [{ product_id: 'prod_a' }],
      },
      candidates: [candidateRow('prod_a', 'manual'), candidateRow('prod_b', 'manual')],
      products: [graphProduct('prod_a'), graphProduct('prod_b')],
    });
    const result = await resolveRecommendations(container, {
      placement: 'product-detail-complementary',
      cart_id: 'cart_1',
    });
    assert.deepEqual(
      result.products.map((p) => p.product_id),
      ['prod_b'],
    );
    assert.equal(result.served_context.sales_channel_id, 'sc_main');
    assert.equal(result.served_context.currency_code, 'ars');
  });

  it('descarta candidatos sin stock', async () => {
    const { container } = harness({
      candidates: [candidateRow('prod_a', 'manual'), candidateRow('prod_b', 'manual')],
      products: [
        graphProduct('prod_a', {
          variants: [
            {
              id: 'v',
              manage_inventory: true,
              calculated_price: { calculated_amount: 1000, currency_code: 'ars' },
              inventory_items: [{ inventory: { location_levels: [{ available_quantity: 0 }] } }],
            },
          ],
        }),
        graphProduct('prod_b'),
      ],
    });
    const result = await resolveRecommendations(container, {
      placement: 'product-detail-complementary',
      region_id: 'reg_1',
    });
    assert.deepEqual(
      result.products.map((p) => p.product_id),
      ['prod_b'],
    );
    assert.equal(result.debug?.discarded.out_of_stock, 1);
  });

  it('resuelve la moneda desde la región cuando no hay carrito', async () => {
    // Sin moneda las variantes no traen precio calculado y todo caería por no_price.
    const { container, graphCalls } = harness({
      region: { id: 'reg_1', currency_code: 'USD' },
      candidates: [candidateRow('prod_a', 'manual')],
      products: [graphProduct('prod_a')],
    });
    await resolveRecommendations(container, {
      placement: 'product-detail-complementary',
      region_id: 'reg_1',
    });
    const productCall = graphCalls.find((c) => c.entity === 'product');
    const context = productCall?.context as { variants: { calculated_price: unknown } };
    assert.match(JSON.stringify(context.variants.calculated_price), /"currency_code":"usd"/);
  });
});

describe('resolveRecommendations — cadena de fallbacks', () => {
  const strategies = [
    strategy('frequently_bought_together', 'frequently_bought_together', {
      fallback_chain: ['manual', 'popular'],
    }),
    strategy('manual', 'manual'),
    strategy('popular', 'popular'),
  ];

  it('pide sólo los tiers que pueden aportar candidatos', async () => {
    // `frequently_bought_together` y `popular` no tienen versión activa todavía, así
    // que la query sólo debería pedir el tier manual.
    const { container, knexCalls } = harness({
      placements: [placement({ key: 'cart-recommendations', strategy_key: 'frequently_bought_together' })],
      strategies,
      candidates: [candidateRow('prod_a', 'manual')],
      products: [graphProduct('prod_a')],
    });
    const result = await resolveRecommendations(container, {
      placement: 'cart-recommendations',
      region_id: 'reg_1',
    });
    const call = lastCandidateQuery(knexCalls);
    assert.equal(tierCount(call?.sql ?? ''), 1);
    assert.deepEqual(result.fallback_chain, ['frequently_bought_together', 'manual', 'popular']);
    assert.equal(result.resolved_strategy_key, 'manual');
    assert.equal(result.fallback_used, true);
  });

  it('pide la versión activa de las estrategias automáticas', async () => {
    const { container, knexCalls } = harness({
      placements: [placement({ key: 'cart-recommendations', strategy_key: 'frequently_bought_together' })],
      strategies,
      versions: [
        { strategy_key: 'frequently_bought_together', sales_channel_id: null, id: 'recver_fbt' },
      ],
      candidates: [candidateRow('prod_a', 'frequently_bought_together', { version_id: 'recver_fbt' })],
      products: [graphProduct('prod_a')],
    });
    const result = await resolveRecommendations(container, {
      placement: 'cart-recommendations',
      region_id: 'reg_1',
    });
    assert.ok(knexCalls.at(-1)?.bindings.includes('recver_fbt'));
    assert.equal(result.resolved_strategy_key, 'frequently_bought_together');
    assert.equal(result.fallback_used, false);
    assert.equal(result.version_id, 'recver_fbt');
  });

  it('la versión por canal gana sobre la global', async () => {
    const { container, knexCalls } = harness({
      placements: [placement({ key: 'cart-recommendations', strategy_key: 'popular' })],
      strategies: [strategy('popular', 'popular')],
      versions: [
        { strategy_key: 'popular', sales_channel_id: null, id: 'recver_global' },
        { strategy_key: 'popular', sales_channel_id: 'sc_demo', id: 'recver_demo' },
      ],
      candidates: [],
    });
    await resolveRecommendations(container, {
      placement: 'cart-recommendations',
      sales_channel_id: 'sc_demo',
    });
    assert.ok(knexCalls.at(-1)?.bindings.includes('recver_demo'));
    assert.ok(!knexCalls.at(-1)?.bindings.includes('recver_global'));
  });

  it('usa el sentinela global para estrategias sin producto de origen', async () => {
    const { container, knexCalls } = harness({
      placements: [placement({ key: 'cart-recommendations', strategy_key: 'popular' })],
      strategies: [strategy('popular', 'popular')],
      versions: [{ strategy_key: 'popular', sales_channel_id: null, id: 'recver_pop' }],
      candidates: [],
    });
    await resolveRecommendations(container, {
      placement: 'cart-recommendations',
      product_id: 'prod_source',
    });
    assert.ok(knexCalls.at(-1)?.bindings.includes('__global__'));
    assert.ok(knexCalls.at(-1)?.bindings.includes('prod_source'));
  });

  it('sin candidatos devuelve vacío pero informa la cadena intentada', async () => {
    const { container, graphCalls } = harness({
      strategies,
      placements: [placement({ key: 'cart-recommendations', strategy_key: 'frequently_bought_together' })],
      candidates: [],
    });
    const result = await resolveRecommendations(container, { placement: 'cart-recommendations' });
    assert.deepEqual(result.products, []);
    assert.deepEqual(result.fallback_chain, ['frequently_bought_together', 'manual', 'popular']);
    assert.equal(result.strategy_key, 'frequently_bought_together');
    // Sin candidatos no se hidrata nada.
    assert.equal(graphCalls.filter((c) => c.entity === 'product').length, 0);
  });
});

describe('resolveRecommendations — vistos recientemente', () => {
  const placements = [
    placement({ key: 'recently-viewed', strategy_key: 'manual', result_limit: 12 }),
  ];

  it('toma los candidatos del contexto sin consultar relaciones', async () => {
    const { container, knexCalls } = harness({
      placements,
      candidates: [],
      products: [graphProduct('prod_a'), graphProduct('prod_b')],
    });
    const result = await resolveRecommendations(container, {
      placement: 'recently-viewed',
      region_id: 'reg_1',
      context: { product_ids: ['prod_a', 'prod_b'] },
    });
    assert.equal(knexCalls.length, 0);
    assert.deepEqual(
      result.products.map((p) => p.product_id),
      ['prod_a', 'prod_b'],
    );
  });

  it('preserva el orden que manda el cliente', async () => {
    // El orden es "lo último que vio primero": el ranking no debe reordenarlo.
    const { container } = harness({
      placements,
      products: [graphProduct('prod_a'), graphProduct('prod_b'), graphProduct('prod_c')],
    });
    const result = await resolveRecommendations(container, {
      placement: 'recently-viewed',
      region_id: 'reg_1',
      context: { product_ids: ['prod_c', 'prod_a', 'prod_b'] },
    });
    assert.deepEqual(
      result.products.map((p) => p.product_id),
      ['prod_c', 'prod_a', 'prod_b'],
    );
  });

  it('excluye el producto que se está mirando', async () => {
    const { container } = harness({
      placements,
      products: [graphProduct('prod_a'), graphProduct('prod_b')],
    });
    const result = await resolveRecommendations(container, {
      placement: 'recently-viewed',
      product_id: 'prod_a',
      region_id: 'reg_1',
      context: { product_ids: ['prod_a', 'prod_b'] },
    });
    assert.deepEqual(
      result.products.map((p) => p.product_id),
      ['prod_b'],
    );
  });

  it('sin ids en el contexto devuelve vacío', async () => {
    const { container } = harness({ placements });
    const result = await resolveRecommendations(container, { placement: 'recently-viewed' });
    assert.deepEqual(result.products, []);
  });
});

describe('resolveRecommendations — bridge de envío gratis', () => {
  const placements = [
    placement({
      key: 'free-shipping-bridge',
      strategy_key: 'popular',
      result_limit: 4,
      candidate_limit: 120,
    }),
  ];
  const strategies = [strategy('popular', 'popular')];
  const versions = [{ strategy_key: 'popular', sales_channel_id: null, id: 'recver_pop' }];

  const pricedProduct = (id: string, amount: number) =>
    graphProduct(id, {
      variants: [
        {
          id: `${id}_v1`,
          manage_inventory: true,
          calculated_price: { calculated_amount: amount, currency_code: 'ars' },
          inventory_items: [{ inventory: { location_levels: [{ available_quantity: 5 }] } }],
        },
      ],
    });

  it('sin monto faltante no devuelve nada', async () => {
    // O el envío ya es gratis, o no hay umbral: en ningún caso hay algo que puentear.
    const { container } = harness({ placements, strategies, versions });
    const result = await resolveRecommendations(container, { placement: 'free-shipping-bridge' });
    assert.deepEqual(result.products, []);
  });

  it('aplica la banda derivada del faltante y prioriza el más barato que cruza', async () => {
    const { container } = harness({
      placements,
      strategies,
      versions,
      candidates: [
        candidateRow('prod_corto', 'popular', { version_id: 'recver_pop' }),
        candidateRow('prod_caro', 'popular', { version_id: 'recver_pop' }),
        candidateRow('prod_justo', 'popular', { version_id: 'recver_pop' }),
        candidateRow('prod_fuera', 'popular', { version_id: 'recver_pop' }),
      ],
      products: [
        pricedProduct('prod_corto', 7000),
        pricedProduct('prod_caro', 11_500),
        pricedProduct('prod_justo', 8200),
        pricedProduct('prod_fuera', 30_000), // fuera de la banda 6000-12000
      ],
    });
    const result = await resolveRecommendations(container, {
      placement: 'free-shipping-bridge',
      region_id: 'reg_1',
      context: { target_price: 8000 },
    });
    assert.deepEqual(
      result.products.map((p) => p.product_id),
      ['prod_justo', 'prod_caro', 'prod_corto'],
    );
    assert.equal(result.debug?.discarded.price_range, 1);
  });

  it('respeta la banda explícita que manda el cliente', async () => {
    const { container } = harness({
      placements,
      strategies,
      versions,
      candidates: [candidateRow('prod_a', 'popular', { version_id: 'recver_pop' })],
      products: [pricedProduct('prod_a', 9000)],
    });
    const result = await resolveRecommendations(container, {
      placement: 'free-shipping-bridge',
      region_id: 'reg_1',
      context: { target_price: 8000, price_min: 100, price_max: 200 },
    });
    assert.deepEqual(result.products, []);
    assert.equal(result.debug?.discarded.price_range, 1);
  });
});

describe('resolveRecommendations — límites', () => {
  it('el límite del request gana sobre el del placement', async () => {
    const { container } = harness({
      candidates: ['a', 'b', 'c', 'd'].map((id) => candidateRow(`prod_${id}`, 'manual')),
      products: ['a', 'b', 'c', 'd'].map((id) => graphProduct(`prod_${id}`)),
    });
    const result = await resolveRecommendations(container, {
      placement: 'product-detail-complementary',
      region_id: 'reg_1',
      limit: 2,
    });
    assert.equal(result.products.length, 2);
    assert.equal(result.limit, 2);
  });

  it('el candidate_limit nunca queda por debajo del límite pedido', async () => {
    const { container, knexCalls } = harness({
      placements: [placement({ result_limit: 8, candidate_limit: 2 })],
      candidates: [],
    });
    await resolveRecommendations(container, {
      placement: 'product-detail-complementary',
      limit: 12,
    });
    assert.ok(Number(knexCalls.at(-1)?.bindings.at(-1)) >= 12);
  });
});
