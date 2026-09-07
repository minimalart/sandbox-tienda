import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

/**
 * Product ids linked to a sales channel.
 *
 * IMPORTANT: `query.graph` CANNOT filter products by `sales_channels` in this
 * Medusa version — passing `filters: { sales_channels: { id } }` throws (500).
 * The index engine CAN (it's what the core /store/products route uses), so we
 * resolve the channel's product ids via `query.index` and let callers filter
 * their `query.graph` catalog/pricing query by `id` (a basic, supported filter).
 *
 * Falls back to a paged scan that selects `sales_channels.id` and filters in JS
 * (the pattern used by promotions.ts / the demo teardown) if the index engine
 * isn't available.
 */
export async function salesChannelProductIds(
  query: any,
  salesChannelId: string,
): Promise<string[]> {
  // Preferred: index engine supports the sales_channels.id filter.
  if (typeof query.index === 'function') {
    try {
      const ids: string[] = [];
      const PAGE = 1000;
      for (let skip = 0; ; skip += PAGE) {
        const { data, metadata } = await query.index({
          entity: 'product',
          fields: ['id'],
          filters: { status: 'published', sales_channels: { id: [salesChannelId] } },
          pagination: { skip, take: PAGE },
        });
        const rows = (data ?? []) as Array<{ id: string }>;
        for (const p of rows) ids.push(p.id);
        const total = metadata?.estimate_count ?? metadata?.count ?? ids.length;
        if (rows.length === 0 || ids.length >= total) break;
      }
      return ids;
    } catch {
      /* fall through to the scan */
    }
  }

  // Fallback: page all published products selecting sales_channels.id, filter JS.
  const ids: string[] = [];
  const PAGE = 200;
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await query.graph({
      entity: 'product',
      fields: ['id', 'sales_channels.id'],
      filters: { status: 'published' },
      pagination: { skip: offset, take: PAGE },
    });
    const rows = (data ?? []) as any[];
    if (rows.length === 0) break;
    for (const p of rows) {
      if (
        Array.isArray(p.sales_channels) &&
        p.sales_channels.some((sc: any) => sc?.id === salesChannelId)
      ) {
        ids.push(p.id as string);
      }
    }
    if (rows.length < PAGE) break;
  }
  return ids;
}

/** Convenience: resolve QUERY from the scope and return the channel's product ids. */
export async function salesChannelProductIdsFromScope(
  scope: { resolve: (k: string) => any },
  salesChannelId: string,
): Promise<string[]> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  return salesChannelProductIds(query, salesChannelId);
}
