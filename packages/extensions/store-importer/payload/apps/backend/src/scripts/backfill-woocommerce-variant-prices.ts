/**
 * Backfill de precios POR VARIACIÓN para productos importados de WooCommerce.
 *
 * Contexto: el importer de demos (modules/store-importer/importers/woocommerce.ts)
 * tomaba el precio del list endpoint del Store API, que sólo trae el precio
 * MÍNIMO del producto. Resultado: todas las variantes (ej. cajón "16 kilos" y
 * "25 kilos") quedaron con el mismo precio. El precio real por tamaño sí existe
 * en WooCommerce (pidiendo cada variación por id). Este script lo re-consulta y
 * corrige el precio de cada variante en Medusa.
 *
 * Resuelve solo la URL de origen (`source_url`) y el sales channel de cada demo
 * WooCommerce desde la tabla `demo_store` — no hace falta pasar nada.
 *
 * Uso (corre contra la DB real; local suele estar fuera del allowlist, así que
 * conviene correrlo en el deploy/prod):
 *   DRY-RUN (no escribe, sólo reporta):   pnpm --filter @repo/backend run backfill:woo-prices
 *   APLICAR:                              pnpm --filter @repo/backend run backfill:woo-prices:apply
 *   Acotar a una demo:                    DEMO_SLUG=dorking pnpm ... run backfill:woo-prices
 *
 * Después de aplicar, re-correr el reindex de Typesense (typesense:sync).
 */
import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import { updateProductVariantsWorkflow } from '@medusajs/core-flows';
import { DEMO_STORE_MODULE } from '../modules/demo-store';
import { fetchWooVariationPrices } from '../modules/store-importer/importers/woocommerce';
import { slugify } from '../modules/demo-store/catalog/util';

const CURRENCY = process.env.DEFAULT_CURRENCY_CODE || 'ars';
const APPLY = process.env.APPLY === 'true';
const DEMO_SLUG = process.env.DEMO_SLUG?.trim() || undefined;
const PAGE = 200;
const WRITE_BATCH = 100;

type VariantUpdate = {
  id: string;
  prices: Array<{ amount: number; currency_code: string }>;
};

type DemoRow = {
  slug: string;
  source_url: string;
  sales_channel_id: string | null;
};

export default async function backfillWooVariantPrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  logger.info(
    `[backfill-woo-prices] modo: ${APPLY ? 'APPLY (escribe)' : 'DRY-RUN (solo lee)'} · currency: ${CURRENCY}${DEMO_SLUG ? ` · demo: ${DEMO_SLUG}` : ''}`,
  );

  // Demos WooCommerce (con su canal) — de ahí salen la base URL y el sales channel.
  // Vía servicio del módulo (el modelo custom no se consulta por query.graph).
  const demoService: any = container.resolve(DEMO_STORE_MODULE);
  const demos = (await demoService.listDemoStores({
    source_type: 'woocommerce',
    ...(DEMO_SLUG ? { slug: DEMO_SLUG } : {}),
  })) as DemoRow[];

  const targets = demos.filter((d) => d.source_url && d.sales_channel_id);
  if (targets.length === 0) {
    logger.warn(
      '[backfill-woo-prices] No hay demos WooCommerce con sales_channel_id (¿slug correcto?).',
    );
    return;
  }

  const toUpdate: VariantUpdate[] = [];
  const changeSamples: string[] = [];
  let totalProducts = 0;
  let totalVariable = 0;
  let totalMatched = 0;
  let totalUnmatched = 0;

  for (const demo of targets) {
    const base = demo.source_url.replace(/\/+$/, '');
    const salesChannelId = demo.sales_channel_id as string;
    logger.info(`[backfill-woo-prices] demo=${demo.slug} · base=${base} · sc=${salesChannelId}`);

    let offset = 0;
    for (;;) {
      const { data: products } = (await query.graph({
        entity: 'product',
        fields: [
          'id',
          'title',
          'metadata',
          'sales_channels.id',
          'variants.id',
          'variants.title',
          'variants.calculated_price.calculated_amount',
        ],
        filters: { sales_channels: { id: salesChannelId } },
        pagination: { skip: offset, take: PAGE },
        context: {
          variants: { calculated_price: QueryContext({ currency_code: CURRENCY }) },
        },
      })) as { data: Array<Record<string, any>> };

      if (products.length === 0) break;
      offset += products.length;

      for (const p of products) {
        const inChannel = (p.sales_channels ?? []).some((sc: any) => sc?.id === salesChannelId);
        const sourceProductId = p?.metadata?.source_product_id;
        if (!inChannel || p?.metadata?.source !== 'woocommerce' || !sourceProductId) continue;
        totalProducts++;

        const variationPrices = await fetchWooVariationPrices(base, String(sourceProductId));
        if (variationPrices.size === 0) continue;
        totalVariable++;

        for (const v of (p.variants ?? []) as Array<Record<string, any>>) {
          if (!v?.id) continue;
          const match = variationPrices.get(slugify(String(v.title ?? '')));
          if (!match) {
            totalUnmatched++;
            continue;
          }
          totalMatched++;
          const current = Number(v?.calculated_price?.calculated_amount);
          if (current === match.price) continue; // ya está bien
          toUpdate.push({
            id: v.id as string,
            prices: [{ amount: match.price, currency_code: CURRENCY }],
          });
          if (changeSamples.length < 15) {
            changeSamples.push(
              `${demo.slug} · ${p.title} · ${v.title}: ${Number.isFinite(current) ? current : '—'} → ${match.price}`,
            );
          }
        }
      }
    }
  }

  logger.info(
    `[backfill-woo-prices] productos=${totalProducts} · con_variaciones=${totalVariable} · variantes_match=${totalMatched} · sin_match=${totalUnmatched} · a_actualizar=${toUpdate.length}`,
  );
  if (changeSamples.length) {
    logger.info(`[backfill-woo-prices] muestra de cambios:\n  ${changeSamples.join('\n  ')}`);
  }

  if (!APPLY) {
    logger.info(
      `[backfill-woo-prices] DRY-RUN: no se escribió nada. Correr :apply para aplicar ${toUpdate.length} updates.`,
    );
    return;
  }

  let applied = 0;
  for (let i = 0; i < toUpdate.length; i += WRITE_BATCH) {
    const batch = toUpdate.slice(i, i + WRITE_BATCH);
    await updateProductVariantsWorkflow(container).run({ input: { product_variants: batch } });
    applied += batch.length;
    logger.info(`[backfill-woo-prices] aplicados ${applied}/${toUpdate.length}`);
  }

  logger.info(
    `[backfill-woo-prices] LISTO. Variantes actualizadas: ${applied}. Ahora re-correr el reindex de Typesense (typesense:sync).`,
  );
}
