/**
 * Typesense full re-index script.
 *
 * Recreates the Typesense products collection from scratch and indexes all
 * published products from the Medusa database.
 *
 * Comparte la lógica de campos + promociones con los subscribers incrementales
 * y el job de reconciliación (modules/typesense/reindex.ts), de modo que el
 * documento indexado sea idéntico por cualquier camino.
 *
 * Run with:
 *   pnpm typesense:sync
 *   or: dotenv -e .env -- medusa exec ./src/scripts/typesense-sync.ts
 */
import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import TypeSenseService from '../modules/typesense/service';
import {
  PRODUCT_SYNC_FIELDS,
  attachActivePromotions,
} from '../modules/typesense/reindex';
import {
  attachCategoryFullPaths,
  buildCategoryPathMap,
} from '../modules/typesense/category-paths';
import { loadAdvisorRules } from '../modules/typesense/advisor';

export default async function typesenseSync({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  logger.info('================================================');
  logger.info('Starting Typesense full re-index...');
  logger.info('================================================');

  const query = container.resolve<{
    graph: (input: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);

  const currencyCode = process.env.DEFAULT_CURRENCY_CODE || 'ars';
  logger.info(`Using currency: ${currencyCode}`);

  // Mapa canónico de rutas de categorías (facets jerárquicos correctos).
  const pathMap = await buildCategoryPathMap(query);
  logger.info(`Category path map built: ${pathMap.size} entries.`);

  // Fetch published products in PAGES. Medusa's calculated_price resolution
  // silently returns null for variants beyond a few thousand rows when the
  // whole catalog is requested in a single query.graph call — paginating keeps
  // each batch small enough that every variant gets its ARS price.
  const PAGE = 200;
  const enrichedProducts: Record<string, unknown>[] = [];

  for (let offset = 0; ; offset += PAGE) {
    const { data: page } = (await query.graph({
      entity: 'product',
      fields: PRODUCT_SYNC_FIELDS as unknown as string[],
      filters: { status: { $ne: 'draft' } },
      pagination: { skip: offset, take: PAGE },
      context: {
        variants: {
          calculated_price: QueryContext({ currency_code: currencyCode }),
        },
      },
    })) as { data: Record<string, unknown>[] };

    if (page.length === 0) break;

    for (const product of page) {
      enrichedProducts.push(attachCategoryFullPaths(product, pathMap));
    }

    if (page.length < PAGE) break;
  }

  logger.info(`Fetched ${enrichedProducts.length} published products (paginated).`);

  // Adjuntar promociones activas (badges + filtro "Promociones"). Ver
  // docs/recipes/promotions.md.
  const withPromos = await attachActivePromotions(query, enrichedProducts, logger);
  logger.info(`Attached promotions to ${withPromos} products.`);

  // Reglas del asesor guiado antes de mapear: si no, este camino indexaría
  // documentos sin los campos `advisor_*` y el flujo guiado no vería nada.
  await loadAdvisorRules(container);

  // Recreate collection and bulk upsert
  const typeSenseService = new TypeSenseService();
  const { upserted, errors } = await typeSenseService.bulkSync(enrichedProducts);

  logger.info('================================================');
  logger.info(`Typesense re-index complete.`);
  logger.info(`  Upserted: ${upserted}`);
  logger.info(`  Errors:   ${errors}`);
  logger.info('================================================');
}
