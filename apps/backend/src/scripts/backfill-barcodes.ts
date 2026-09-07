/**
 * Backfill the native `variant.barcode` field on already-imported products.
 *
 * The VTEX import (import-vtex.ts) stores the EAN in `variant.sku` (whitespace
 * stripped) and in `product.metadata.ean`, but leaves the native
 * `variant.barcode` empty. The barcode scanner already matches on sku, but
 * populating `barcode` keeps the data clean and shows it in the admin.
 *
 * This sets `variant.barcode = metadata.ean (normalized) || variant.sku` for
 * every variant whose barcode is still empty. Idempotent: variants that
 * already have a barcode are skipped, so it can be re-run safely.
 *
 * Run with:
 *   pnpm vtex:backfill-barcodes
 *   or: dotenv -e .env -- medusa exec ./src/scripts/backfill-barcodes.ts
 *
 * NOTE: requires a reachable DB. Locally the DO prod DB is blocked by the
 * allowlist, so run this on the deploy (like migrations) or via a tunnel.
 */
import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';

const PAGE = 1000;
const UPDATE_BATCH = 200;

// Mirror the scanner's normalization so the stored barcode matches what a
// scan produces (no spaces/dashes).
const normalize = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const out = String(value).trim().replace(/[\s-]+/g, '');
  return out.length > 0 ? out : null;
};

export default async function backfillBarcodes({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const productService: any = container.resolve(Modules.PRODUCT);

  logger.info('================================================');
  logger.info('Backfilling variant.barcode from EAN/SKU...');
  logger.info('================================================');

  const updates: Array<{ id: string; barcode: string }> = [];
  let scanned = 0;
  let skip = 0;

  // Paginate through every product + its variants.
  for (;;) {
    const { data: products } = (await query.graph({
      entity: 'product',
      fields: [
        'id',
        'metadata',
        'variants.id',
        'variants.sku',
        'variants.barcode',
        'variants.ean',
        'variants.metadata',
      ],
      pagination: { take: PAGE, skip },
    })) as {
      data: Array<{
        id: string;
        metadata?: Record<string, unknown> | null;
        variants?: Array<{
          id: string;
          sku?: string | null;
          barcode?: string | null;
          ean?: string | null;
          metadata?: Record<string, unknown> | null;
        }> | null;
      }>;
    };

    if (products.length === 0) break;

    for (const product of products) {
      const productEan = product.metadata?.ean;
      for (const variant of product.variants ?? []) {
        scanned++;
        // Already has a barcode → leave it alone.
        if (normalize(variant.barcode)) continue;

        const barcode =
          normalize(variant.ean) ??
          normalize(variant.metadata?.ean) ??
          normalize(productEan) ??
          normalize(variant.sku);

        if (barcode) {
          updates.push({ id: variant.id, barcode });
        }
      }
    }

    skip += products.length;
    if (products.length < PAGE) break;
  }

  logger.info(`  Scanned ${scanned} variants; ${updates.length} need a barcode.`);

  let updated = 0;
  for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
    const batch = updates.slice(i, i + UPDATE_BATCH);
    await productService.updateProductVariants(
      batch.map((u) => ({ id: u.id, barcode: u.barcode })),
    );
    updated += batch.length;
    logger.info(`  Updated ${updated}/${updates.length} variants.`);
  }

  logger.info('================================================');
  logger.info('Barcode backfill complete.');
  logger.info(`  Variants updated: ${updated}`);
  logger.info('  Next: run "pnpm typesense:sync" if you index barcode.');
}
