"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_flows_1 = require("@medusajs/medusa/core-flows");
const utils_1 = require("@medusajs/framework/utils");
const gift_cards_shared_1 = require("../../lib/gift-cards-shared");
const gift_card_experience_1 = require("../../modules/gift-card-experience");
const process_order_1 = require("../../modules/gift-card-experience/process-order");
const schedule_1 = require("../../modules/gift-card-experience/schedule");
const resolve_site_1 = require("../../lib/multistore/resolve-site");
core_flows_1.completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
    const typedCart = cart;
    const giftItems = (typedCart.items ?? []).filter((item) => item.product?.is_giftcard === true || item.variant?.product?.is_giftcard === true);
    if (giftItems.length === 0)
        return;
    const service = container.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
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
    const settings = await service.getSettings(await (0, resolve_site_1.siteIdOfChannel)(container, typedCart.sales_channel_id));
    if (!(0, process_order_1.isGiftCardExperienceEnabled)(settings.enabled)) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'La venta de gift cards no está habilitada.');
    }
    const creditReferences = new Set((typedCart.credit_lines ?? []).map((line) => line.reference));
    if (creditReferences.has('gift-card') || creditReferences.has('store-credit')) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'No se puede comprar una gift card usando otra gift card o saldo acreditado.');
    }
    const promotionIds = (typedCart.promotions ?? []).map((promotion) => promotion.id);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const promotionRows = promotionIds.length
        ? (await query.graph({ entity: 'promotion', fields: ['id', 'metadata'], filters: { id: promotionIds } })).data
        : [];
    const promotions = new Map(promotionRows.map((promotion) => [promotion.id, promotion]));
    for (const item of giftItems) {
        const config = (0, gift_cards_shared_1.normalizeGiftCardConfig)(item.metadata ?? {}, settings.default_design_id);
        (0, gift_cards_shared_1.assertGiftCardBuyerIsNotRecipient)(config, typedCart.email);
        (0, schedule_1.resolveScheduledAt)(config.delivery, settings);
        const design = await service.resolveDesign(config.design_id);
        if (!design) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, 'El diseño de gift card ya no está disponible.');
        }
        for (const adjustment of item.adjustments ?? []) {
            if (!adjustment.promotion_id)
                continue;
            const promotion = promotions.get(adjustment.promotion_id);
            if (promotion?.metadata?.gift_card_campaign !== true) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'Las promociones generales no se aplican a gift cards.');
            }
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2lmdC1jYXJkLWNhcnQtdmFsaWRhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3MvaG9va3MvZ2lmdC1jYXJkLWNhcnQtdmFsaWRhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDREQUFtRTtBQUNuRSxxREFBbUY7QUFDbkYsbUVBR3FDO0FBQ3JDLDZFQUFpRjtBQUVqRixvRkFBK0Y7QUFDL0YsMEVBQWlGO0FBQ2pGLG9FQUFvRTtBQWtCcEUsaUNBQW9CLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDcEUsTUFBTSxTQUFTLEdBQUcsSUFBWSxDQUFDO0lBQy9CLE1BQU0sU0FBUyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQzlDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFdBQVcsS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsV0FBVyxLQUFLLElBQUksQ0FDNUYsQ0FBQztJQUNGLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDO1FBQUUsT0FBTztJQUVuQyxNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFrQyxrREFBMkIsQ0FBQyxDQUFDO0lBQ2hHOzs7Ozs7Ozs7T0FTRztJQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLFdBQVcsQ0FDeEMsTUFBTSxJQUFBLDhCQUFlLEVBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUM3RCxDQUFDO0lBQ0YsSUFBSSxDQUFDLElBQUEsMkNBQTJCLEVBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDbkQsTUFBTSxJQUFJLG1CQUFXLENBQUMs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