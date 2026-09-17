import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBundleForPublish } from './publish-validation';

/**
 * publish-validation aggregates issues; tests aim at the aggregation logic
 * (no_items / invalid_quantity / product_missing / variant_not_in_channel)
 * without spinning up Medusa. The container is a hand-rolled stub because
 * the function only uses `container.resolve(BUNDLE_MODULE)` (list items) and
 * `container.resolve(QUERY)` (products + stores).
 */

interface StubItem {
  id: string;
  product_id: string;
  quantity: number;
}

const makeContainer = (opts: {
  items: StubItem[];
  stores?: Array<{ id: string; sales_channel_id?: string }>;
  products?: Array<{
    id: string;
    status: string;
    variants: Array<{
      id: string;
      manage_inventory?: boolean;
      allow_backorder?: boolean;
      sales_channels?: Array<{ id: string }>;
    }>;
  }>;
  storesThrow?: boolean;
}) => ({
  resolve: (key: string) => {
    if (key === 'bundle') {
      return {
        listBundleItems: async () => opts.items,
      };
    }
    // ContainerRegistrationKeys.QUERY resolves to a specific string; we
    // shortcut by matching any non-bundle key with the query stub.
    return {
      graph: async ({ entity, filters }: any) => {
        if (entity === 'bundle') {
          if (opts.storesThrow) throw new Error('demo_store missing');
          return { data: [{ id: 'bndl_1', demo_stores: opts.stores ?? [] }] };
        }
        if (entity === 'product') {
          const ids: string[] = Array.isArray(filters?.id) ? filters.id : [filters?.id];
          const data = (opts.products ?? []).filter((p) => ids.includes(p.id));
          return { data };
        }
        return { data: [] };
      },
    };
  },
});

test('validateBundleForPublish: bundle sin items reporta no_items', async () => {
  const container = makeContainer({ items: [] });
  const result = await validateBundleForPublish(container as any, 'bndl_1');
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'no_items'));
});

test('validateBundleForPublish: quantity <= 0 se reporta como invalid_quantity', async () => {
  const container = makeContainer({
    items: [{ id: 'bi_1', product_id: 'prod_1', quantity: 0 }],
    products: [{ id: 'prod_1', status: 'published', variants: [{ id: 'var_1' }] }],
  });
  const result = await validateBundleForPublish(container as any, 'bndl_1');
  assert.ok(result.issues.some((i) => i.code === 'invalid_quantity'));
});

test('validateBundleForPublish: product missing se reporta con product_id', async () => {
  const container = makeContainer({
    items: [{ id: 'bi_1', product_id: 'prod_missing', quantity: 1 }],
    products: [],
  });
  const result = await validateBundleForPublish(container as any, 'bndl_1');
  const issue = result.issues.find((i) => i.code === 'product_missing');
  assert.ok(issue);
  assert.equal(issue!.product_id, 'prod_missing');
});

test('validateBundleForPublish: product unpublished se separa de missing', async () => {
  const container = makeContainer({
    items: [{ id: 'bi_1', product_id: 'prod_1', quantity: 1 }],
    products: [{ id: 'prod_1', status: 'draft', variants: [{ id: 'var_1' }] }],
  });
  const result = await validateBundleForPublish(container as any, 'bndl_1');
  assert.ok(result.issues.some((i) => i.code === 'product_unpublished'));
});

test('validateBundleForPublish: variant fuera del channel de la store', async () => {
  const container = makeContainer({
    items: [{ id: 'bi_1', product_id: 'prod_1', quantity: 1 }],
    stores: [{ id: 'store_A', sales_channel_id: 'sc_A' }],
    products: [
      {
        id: 'prod_1',
        status: 'published',
        variants: [{ id: 'var_1', sales_channels: [{ id: 'sc_OTHER' }] }],
      },
    ],
  });
  const result = await validateBundleForPublish(container as any, 'bndl_1');
  const issue = result.issues.find((i) => i.code === 'variant_not_in_store_channel');
  assert.ok(issue);
  assert.equal(issue!.store_id, 'store_A');
});

test('validateBundleForPublish: ok cuando todo válido', async () => {
  const container = makeContainer({
    items: [{ id: 'bi_1', product_id: 'prod_1', quantity: 2 }],
    stores: [{ id: 'store_A', sales_channel_id: 'sc_A' }],
    products: [
      {
        id: 'prod_1',
        status: 'published',
        variants: [{ id: 'var_1', sales_channels: [{ id: 'sc_A' }] }],
      },
    ],
  });
  const result = await validateBundleForPublish(container as any, 'bndl_1');
  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
});
