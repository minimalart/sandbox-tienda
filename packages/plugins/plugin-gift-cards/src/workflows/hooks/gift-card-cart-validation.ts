import { registerCartValidation } from '@minimalart/mercatto-plugin-runtime';
import { StepResponse } from '@medusajs/framework/workflows-sdk';
import { completeCartWorkflow } from '@medusajs/medusa/core-flows';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import {
  assertGiftCardBuyerIsNotRecipient,
  normalizeGiftCardConfig,
} from '../../lib/gift-cards-shared';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../modules/gift-card-experience/service';
import { isGiftCardExperienceEnabled } from '../../modules/gift-card-experience/process-order';
import { resolveScheduledAt } from '../../modules/gift-card-experience/schedule';
import { siteIdOfChannel } from '../../lib/multistore/resolve-site';

type CartAdjustment = { promotion_id?: string | null };
type CartItem = {
  product?: { is_giftcard?: boolean } | null;
  variant?: { product?: { is_giftcard?: boolean } | null } | null;
  metadata?: Record<string, unknown> | null;
  adjustments?: CartAdjustment[] | null;
};
type Cart = {
  email?: string | null;
  /** Viene en `completeCartFields`, así que siempre está en este hook. */
  sales_channel_id?: string | null;
  items?: CartItem[] | null;
  credit_lines?: Array<{ reference?: string | null }> | null;
  promotions?: Array<{ id: string; metadata?: Record<string, unknown> | null }> | null;
};

registerCartValidation(completeCartWorkflow, 'gift-cards', async ({ cart }, { container }) => {
  const typedCart = cart as Cart;
  const giftItems = (typedCart.items ?? []).filter(
    (item) => item.product?.is_giftcard === true || item.variant?.product?.is_giftcard === true,
  );
  if (giftItems.length === 0) return;

  const service = container.resolve(GIFT_CARD_EXPERIENCE_MODULE) as GiftCardExperienceModuleService;
  /**
   * La MISMA configuración con la que `createGiftCardIntentsForOrder` va a sellar la
   * entrega, y por eso se resuelve la tienda acá también.
   *
   * No es simetría por prolijidad: `resolveScheduledAt` TIRA si la fecha elegida cae
   * fuera del horizonte o no existe en la zona horaria. Si el checkout validara con
   * la global y el intent se sellara con la de la tienda, una entrega programada
   * aceptada al pagar podría explotar después dentro del subscriber — con la orden ya
   * cobrada y sin ninguna gift card creada.
   */
  const settings = await service.getSettings(
    await siteIdOfChannel(container, typedCart.sales_channel_id),
  );
  if (!isGiftCardExperienceEnabled(settings.enabled)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'La venta de gift cards no está habilitada.');
  }

  const creditReferences = new Set((typedCart.credit_lines ?? []).map((line) => line.reference));
  if (creditReferences.has('gift-card') || creditReferences.has('store-credit')) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'No se puede comprar una gift card usando otra gift card o saldo acreditado.',
    );
  }

  const promotionIds = (typedCart.promotions ?? []).map((promotion) => promotion.id);
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as { graph(input: unknown): Promise<{ data: unknown[] }> };
  const promotionRows = promotionIds.length
    ? (await query.graph({ entity: 'promotion', fields: ['id', 'metadata'], filters: { id: promotionIds } })).data as Array<{ id: string; metadata?: Record<string, unknown> | null }>
    : [];
  const promotions = new Map(promotionRows.map((promotion) => [promotion.id, promotion]));
  for (const item of giftItems) {
    const config = normalizeGiftCardConfig(item.metadata ?? {}, settings.default_design_id);
    assertGiftCardBuyerIsNotRecipient(config, typedCart.email);
    resolveScheduledAt(config.delivery, settings);
    const design = await service.resolveDesign(config.design_id);
    if (!design) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'El diseño de gift card ya no está disponible.');
    }
    for (const adjustment of item.adjustments ?? []) {
      if (!adjustment.promotion_id) continue;
      const promotion = promotions.get(adjustment.promotion_id);
      if (promotion?.metadata?.gift_card_campaign !== true) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          'Las promociones generales no se aplican a gift cards.',
        );
      }
    }
  }
}, undefined, (data) => new StepResponse(undefined, data));
