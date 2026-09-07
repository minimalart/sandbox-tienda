import {
  createPromotionsWorkflow,
  deletePromotionsWorkflow,
  updatePromotionsStatusWorkflow,
  updatePromotionsWorkflow,
} from '@medusajs/medusa/core-flows';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import {
  fetchActivePromotions,
  invalidateReindexCaches,
  resolvePromotionTargetProductIds,
} from '../../modules/typesense/reindex';
import { enqueueProductReindex } from '../../modules/typesense/reindex-queue';
import TypeSenseService from '../../modules/typesense/service';

/**
 * Promociones → reindexar los productos apuntados.
 *
 * Verificado en `@medusajs/core-flows`: los workflows de promoción NO emiten
 * ningún evento, pero SÍ exponen hooks. Sin esto, `has_promotion`, `promotions`,
 * `discount` y `subtotal` sólo se actualizaban en un sync completo: crear una
 * promo no se veía en el storefront hasta el próximo barrido.
 */

type QueryGraph = { graph: (input: unknown) => Promise<{ data: unknown[] }> };

/** Resuelve los targets de esas promos y las encola. */
async function enqueuePromotionTargets(
  container: MedusaContainer,
  promotionIds: string[],
  source: string
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const ids = promotionIds.filter(Boolean);
  if (ids.length === 0) return;

  try {
    // El set de promos activas cambió: el mapa cacheado ya no sirve.
    invalidateReindexCaches('promotions');

    const query = container.resolve<QueryGraph>(ContainerRegistrationKeys.QUERY);
    const promotions = await fetchActivePromotions(query);
    const touched = new Set(ids);
    const collectionCache = new Map<string, string[]>();
    const productIds = new Set<string>();

    for (const promotion of promotions) {
      if (!touched.has(promotion.id)) continue;
      for (const productId of await resolvePromotionTargetProductIds(
        query,
        promotion,
        collectionCache
      )) {
        productIds.add(productId);
      }
    }

    // Una promo que pasó a inactiva (o que se borró) ya no aparece en las
    // activas: los productos a corregir son los que el ÍNDICE dice que la
    // tenían. Sin esto, desactivar una promo dejaba el badge puesto para siempre.
    const stillActive = new Set(promotions.map((promotion) => promotion.id));
    const gone = ids.filter((id) => !stillActive.has(id));
    if (gone.length) {
      const typesense = new TypeSenseService();
      for (const promotionId of gone) {
        try {
          const affected = await typesense.listDocumentIdsByFilter(
            `promotions.id:=\`${promotionId.replace(/`/g, '')}\``
          );
          for (const productId of affected) productIds.add(productId);
        } catch (error) {
          logger.warn(
            `[Typesense Sync] No se pudo resolver los productos de la promo ${promotionId} en el índice: ${(error as Error).message}`
          );
        }
      }
    }

    if (productIds.size === 0) return;
    enqueueProductReindex(container, [...productIds], source);
    logger.info(
      `[Typesense Sync] ${source}: ${productIds.size} productos encolados por cambio de promoción.`
    );
  } catch (error) {
    logger.warn(
      `[Typesense Sync] ${source}: no se pudieron encolar los productos de la promoción: ${(error as Error).message}`
    );
  }
}

type PromotionsHookInput = { promotions?: Array<{ id?: string | null }> | null };

const promotionIdsFrom = (input: PromotionsHookInput): string[] =>
  (input.promotions ?? []).map((promotion) => promotion?.id).filter((id): id is string => Boolean(id));

createPromotionsWorkflow.hooks.promotionsCreated(async (input, { container }) => {
  await enqueuePromotionTargets(
    container,
    promotionIdsFrom(input as PromotionsHookInput),
    'promotion.created'
  );
});

updatePromotionsWorkflow.hooks.promotionsUpdated(async (input, { container }) => {
  await enqueuePromotionTargets(
    container,
    promotionIdsFrom(input as PromotionsHookInput),
    'promotion.updated'
  );
});

updatePromotionsStatusWorkflow.hooks.promotionStatusUpdated(async (input, { container }) => {
  await enqueuePromotionTargets(
    container,
    promotionIdsFrom(input as PromotionsHookInput),
    'promotion.status-updated'
  );
});

deletePromotionsWorkflow.hooks.promotionsDeleted(async (input, { container }) => {
  const { ids } = input as { ids?: string[] | null };
  await enqueuePromotionTargets(container, ids ?? [], 'promotion.deleted');
});
