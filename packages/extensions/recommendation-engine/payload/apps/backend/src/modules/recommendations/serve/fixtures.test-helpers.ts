import type { Candidate, HydratedProduct, HydratedVariant, ScoredCandidate } from '../types';

/**
 * Constructores de fixtures para los tests del serve path. Viven en un archivo
 * aparte (sin sufijo `.test.ts`, así el runner no lo toma como suite) para que
 * filters/ranking/bridge compartan exactamente la misma forma de producto y un
 * cambio en `HydratedProduct` rompa en un solo lugar.
 */

export const variant = (overrides: Partial<HydratedVariant> = {}): HydratedVariant => ({
  id: 'variant_1',
  sku: 'SKU-1',
  title: 'Default',
  manage_inventory: true,
  calculated_amount: 1000,
  original_amount: 1000,
  currency_code: 'ars',
  available: 5,
  ...overrides,
});

export const product = (overrides: Partial<HydratedProduct> = {}): HydratedProduct => ({
  id: 'prod_1',
  title: 'Producto',
  handle: 'producto',
  thumbnail: null,
  status: 'published',
  collection_id: null,
  type_id: null,
  brand_id: null,
  brand_name: null,
  category_ids: [],
  tag_values: [],
  sales_channel_ids: ['sc_main'],
  metadata: null,
  variants: [variant()],
  ...overrides,
});

export const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  target_product_id: 'prod_1',
  strategy_key: 'manual',
  relation_type: 'complementary',
  priority: 0,
  score: 0,
  confidence: null,
  co_occurrences: null,
  version_id: null,
  ...overrides,
});

/** Par (candidato, producto) coherente: el id del producto manda. */
export const pair = (
  productOverrides: Partial<HydratedProduct> = {},
  candidateOverrides: Partial<Candidate> = {},
): ScoredCandidate => {
  const p = product(productOverrides);
  return { product: p, candidate: candidate({ target_product_id: p.id, ...candidateOverrides }) };
};

/** Contexto de elegibilidad vacío (sin origen, sin carrito, con canal). */
export const emptyContext = (overrides: Record<string, unknown> = {}) => ({
  source_product_id: null,
  source_product: null,
  cart_product_ids: new Set<string>(),
  exclude_product_ids: new Set<string>(),
  sales_channel_id: 'sc_main',
  ...overrides,
});
