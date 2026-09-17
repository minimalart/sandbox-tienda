import type { MedusaContainer, RemoteQueryFunction } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { BUNDLE_MODULE } from './index';
import { getSalesModes } from '../../lib/multistore/sales-mode-store';
import { canBeBundled } from '../../lib/multistore/sales-mode';

/**
 * Publish validation (PRD §38) — a Bundle can only transition to `published`
 * when EVERY assertion below holds. Errors are collected and returned as a
 * list so the admin can render all issues at once instead of one-by-one.
 */

export interface PublishValidationIssue {
  code:
    | 'no_stores'
    | 'no_items'
    | 'invalid_quantity'
    | 'product_missing'
    | 'product_unpublished'
    | 'no_buyable_variants'
    | 'variant_not_in_store_channel'
    | 'product_standalone_in_store';
  message: string;
  bundle_item_id?: string;
  product_id?: string;
  store_id?: string;
}

export interface PublishValidationResult {
  ok: boolean;
  issues: PublishValidationIssue[];
  stats: {
    stores: number;
    items: number;
    products_checked: number;
  };
}

export const validateBundleForPublish = async (
  container: MedusaContainer,
  bundleId: string,
): Promise<PublishValidationResult> => {
  const service: any = container.resolve(BUNDLE_MODULE);
  const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(
    ContainerRegistrationKeys.QUERY,
  );
  const issues: PublishValidationIssue[] = [];

  const items = (await service.listBundleItems(
    { bundle_id: bundleId },
    { order: { position: 'ASC' } },
  )) as Array<{
    id: string;
    product_id: string;
    quantity: number;
  }>;

  if (!items.length) {
    issues.push({ code: 'no_items', message: 'Bundle has no items.' });
  }

  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      issues.push({
        code: 'invalid_quantity',
        message: `Invalid quantity ${item.quantity} for item.`,
        bundle_item_id: item.id,
      });
    }
  }

  // Linked stores + product graph traversal. When demo-store is not present
  // Query throws; we treat that as "no stores available" and continue with
  // product-only checks.
  let storeIds: string[] = [];
  let storesToChannels: Record<string, string[]> = {};
  try {
    const { data } = await query.graph({
      entity: 'bundle',
      fields: ['id', 'demo_stores.id', 'demo_stores.sales_channel_id'],
      filters: { id: bundleId },
    });
    const bundle = data?.[0] as
      | {
          demo_stores?: Array<{ id: string; sales_channel_id?: string }>;
        }
      | undefined;
    for (const store of bundle?.demo_stores ?? []) {
      storeIds.push(store.id);
      if (store.sales_channel_id) {
        storesToChannels[store.id] = [store.sales_channel_id];
      } else {
        storesToChannels[store.id] = [];
      }
    }
  } catch {
    /* demo_store not registered — leave storeIds empty. */
  }

  if (!storeIds.length) {
    issues.push({ code: 'no_stores', message: 'Bundle is not linked to any Store.' });
  }

  const productIds = Array.from(new Set(items.map((it) => it.product_id).filter(Boolean)));
  let productsById: Record<
    string,
    {
      id: string;
      status: string;
      variants: Array<{
        id: string;
        manage_inventory: boolean;
        allow_backorder: boolean;
        sales_channels?: Array<{ id: string }>;
      }>;
    }
  > = {};

  if (productIds.length) {
    try {
      const { data } = await query.graph({
        entity: 'product',
        fields: [
          'id',
          'status',
          'variants.id',
          'variants.manage_inventory',
          'variants.allow_backorder',
          'variants.sales_channels.id',
        ],
        filters: { id: productIds },
      });
      for (const p of (data ?? []) as Array<{
        id: string;
        status: string;
        variants?: Array<{
          id: string;
          manage_inventory: boolean;
          allow_backorder: boolean;
          sales_channels?: Array<{ id: string }>;
        }>;
      }>) {
        productsById[p.id] = {
          id: p.id,
          status: p.status,
          variants: p.variants ?? [],
        };
      }
    } catch {
      /* Query failed — flag every product as missing to force manual review. */
    }
  }

  for (const item of items) {
    const product = productsById[item.product_id];
    if (!product) {
      issues.push({
        code: 'product_missing',
        message: `Product ${item.product_id} not found.`,
        bundle_item_id: item.id,
        product_id: item.product_id,
      });
      continue;
    }
    if (product.status !== 'published') {
      issues.push({
        code: 'product_unpublished',
        message: `Product ${item.product_id} is not published.`,
        bundle_item_id: item.id,
        product_id: item.product_id,
      });
    }
    if (!product.variants.length) {
      issues.push({
        code: 'no_buyable_variants',
        message: `Product ${item.product_id} has no variants.`,
        bundle_item_id: item.id,
        product_id: item.product_id,
      });
      continue;
    }

    // For each linked Store, at least one variant must belong to the Store's
    // sales channel. Products are linked to channels via
    // product_sales_channel; we surface `variants.sales_channels` because
    // that's the same shape the Query used above.
    for (const storeId of storeIds) {
      const channels = storesToChannels[storeId] ?? [];
      if (!channels.length) continue; // Store has no channel yet — a warning but not a blocker.
      const hasBuyable = product.variants.some((v) =>
        (v.sales_channels ?? []).some((c) => channels.includes(c.id)),
      );
      if (!hasBuyable) {
        issues.push({
          code: 'variant_not_in_store_channel',
          message: `Product ${item.product_id} has no variant available in store ${storeId}.`,
          bundle_item_id: item.id,
          product_id: item.product_id,
          store_id: storeId,
        });
      }
    }
  }

  // Modo de venta por tienda (PRD Bundles V2 §12): un producto marcado como
  // `standalone` en una tienda dice, explícitamente, que ahí se vende solo. Que
  // aparezca dentro de un kit de esa misma tienda es una contradicción de
  // configuración, no un caso de uso — y sólo se llega marcándolo a mano, así
  // que se bloquea la publicación en vez de dejar un kit que ofrece algo que la
  // tienda no quiere ofrecer en kits.
  for (const storeId of storeIds) {
    const modes = await getSalesModes(container, storeId, productIds);
    for (const item of items) {
      const mode = modes.get(item.product_id);
      if (mode && !canBeBundled(mode)) {
        issues.push({
          code: 'product_standalone_in_store',
          message: `Product ${item.product_id} is marked as standalone-only in store ${storeId}.`,
          bundle_item_id: item.id,
          product_id: item.product_id,
          store_id: storeId,
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    stats: {
      stores: storeIds.length,
      items: items.length,
      products_checked: productIds.length,
    },
  };
};
