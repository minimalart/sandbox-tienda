/**
 * Backfill de precios ARS para productos que quedaron SIN precio.
 *
 * Contexto: la importación VTEX/Carrefour creó ~1040 productos sin precio en ARS
 * (variant con calculated_price nulo). El storefront los oculta con el filtro base
 * `price:>0`, por eso la tienda mostraba 3997 de 5036. La importación guardó el
 * precio de lista en `product.metadata.vtex_list_price`, que usamos como fuente.
 *
 * Uso (correr en el backend, con DATABASE_URL real):
 *   DRY-RUN (no escribe, solo reporta):
 *     pnpm --filter @repo/backend exec medusa exec ./src/scripts/backfill-ars-prices.ts
 *   APLICAR:
 *     APPLY=true pnpm --filter @repo/backend exec medusa exec ./src/scripts/backfill-ars-prices.ts
 *
 * Después de aplicar, re-correr el reindex de Typesense (typesense-sync.ts).
 */
import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import { updateProductVariantsWorkflow } from '@medusajs/core-flows';

const CURRENCY = process.env.DEFAULT_CURRENCY_CODE || 'ars';
const APPLY = process.env.APPLY === 'true';
const PAGE = 200;
const WRITE_BATCH = 100;

type VariantUpdate = {
  id: string;
  prices: Array<{ amount: number; currency_code: string }>;
};

export default async function backfillArsPrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  logger.info(
    `[backfill-ars-prices] modo: ${APPLY ? 'APPLY (escribe)' : 'DRY-RUN (solo lee)'} · currency: ${CURRENCY}`
  );

  let offset = 0;
  let scanned = 0;
  let noPrice = 0; // productos sin precio ARS
  let fixable = 0; // de esos, con vtex_list_price usable
  let noSource = 0; // sin fuente de precio
  const fixableSamples: string[] = [];
  const noSourceSamples: string[] = [];
  const toUpdate: VariantUpdate[] = [];

  for (;;) {
    const { data: products } = (await query.graph({
      entity: 'product',
      fields: [
        'id',
        'title',
        'metadata',
        'variants.id',
        'variants.calculated_price.calculated_amount',
      ],
      filters: { status: 'published' },
      pagination: { skip: offset, take: PAGE },
      context: {
        variants: {
          calculated_price: QueryContext({ currency_code: CURRENCY }),
        },
      },
    })) as { data: Array<Record<string, any>> };

    if (products.length === 0) break;

    for (const p of products) {
      scanned++;
      const variants: Array<Record<string, any>> = Array.isArray(p.variants)
        ? p.variants
        : [];

      const hasArsPrice = variants.some(
        (v) => Number(v?.calculated_price?.calculated_amount) > 0
      );
      if (hasArsPrice) continue;

      noPrice++;
      const listPrice = Number(p?.metadata?.vtex_list_price);
      if (Number.isFinite(listPrice) && listPrice > 0) {
        fixable++;
        if (fixableSamples.length < 10) {
          fixableSamples.push(`${p.title} → ${listPrice}`);
        }
        for (const v of variants) {
          if (v?.id) {
            toUpdate.push({
              id: v.id as string,
              prices: [{ amount: listPrice, currency_code: CURRENCY }],
            });
          }
        }
      } else {
        noSource++;
        if (noSourceSamples.length < 10) {
          noSourceSamples.push(p.title as string);
        }
      }
    }

    offset += products.length;
  }

  logger.info(
    `[backfill-ars-prices] escaneados=${scanned} · sin_precio_ARS=${noPrice} · con_vtex_list_price=${fixable} · sin_fuente=${noSource} · variantes_a_actualizar=${toUpdate.length}`
  );
  if (fixableSamples.length) {
    logger.info(
      `[backfill-ars-prices] muestra recuperables:\n  ${fixableSamples.join('\n  ')}`
    );
  }
  if (noSourceSamples.length) {
    logger.info(
      `[backfill-ars-prices] muestra SIN fuente de precio (quedan ocultos, requieren carga manual):\n  ${noSourceSamples.join('\n  ')}`
    );
  }

  if (!APPLY) {
    logger.info(
      `[backfill-ars-prices] DRY-RUN: no se escribió nada. Correr con APPLY=true para aplicar ${toUpdate.length} updates.`
    );
    return;
  }

  let applied = 0;
  for (let i = 0; i < toUpdate.length; i += WRITE_BATCH) {
    const batch = toUpdate.slice(i, i + WRITE_BATCH);
    await updateProductVariantsWorkflow(container).run({
      input: { product_variants: batch },
    });
    applied += batch.length;
    logger.info(`[backfill-ars-prices] aplicados ${applied}/${toUpdate.length}`);
  }

  logger.info(
    `[backfill-ars-prices] LISTO. Variantes actualizadas: ${applied}. Ahora re-correr el reindex de Typesense para que aparezcan en la tienda.`
  );
}
