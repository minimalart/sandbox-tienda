"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = handlePointsOrderPlaced;
const utils_1 = require("@medusajs/framework/utils");
const points_1 = require("../modules/points");
const loyalty_1 = require("../modules/loyalty");
const earn_loyalty_points_1 = require("../workflows/earn-loyalty-points");
const settings_1 = require("../modules/loyalty/settings");
async function handlePointsOrderPlaced({ event, container, }) {
    const orderId = event.data.id;
    if (!orderId)
        return;
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: orders } = (await query.graph({
        entity: 'order',
        fields: [
            'id', 'customer_id', 'item_total', 'metadata',
            'sales_channel.id', 'sales_channel.metadata',
            'items.total', 'items.product.is_giftcard',
            'items.product.collection_id', 'items.product.categories.id',
        ],
        filters: { id: orderId },
    }));
    const order = orders[0];
    // Guest checkout (no customer) → no points to earn.
    if (!order || !order.customer_id)
        return;
    // Points are a B2C-only benefit. Skip B2B orders (mayorista).
    const channelType = order.sales_channel?.metadata?.channel_type;
    const context = order.metadata?.context;
    if (channelType === 'b2b' || context === 'b2b') {
        logger.info(`[Loyalty] Skipping B2B order ${order.id} — points are B2C-only.`);
        return;
    }
    // Gift cards move value rather than create eligible merchandise revenue.
    const eligibleItems = (order.items ?? []).filter((item) => item.product?.is_giftcard !== true);
    const amount = eligibleItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    if (amount <= 0)
        return;
    const categoryIds = [
        ...new Set(eligibleItems.flatMap((i) => (i.product?.categories ?? []).map((c) => c.id)).filter(Boolean)),
    ];
    const collectionIds = [
        ...new Set(eligibleItems.map((i) => i.product?.collection_id).filter((id) => !!id)),
    ];
    try {
        const loyalty = container.resolve(loyalty_1.LOYALTY_MODULE);
        const program = await loyalty.getActiveProgram();
        if (program) {
            // Rule-based earning (Loyalty Engine).
            const { result } = await (0, earn_loyalty_points_1.earnLoyaltyPointsWorkflow)(container).run({
                input: {
                    customer_id: order.customer_id,
                    event: 'purchase',
                    amount,
                    reference: 'order',
                    reference_id: order.id,
                    sales_channel_id: order.sales_channel?.id ?? null,
                    category_ids: categoryIds,
                    collection_ids: collectionIds,
                },
            });
            const total = (result?.awarded ?? []).reduce((s, a) => s + a.points, 0);
            logger.info(`[Loyalty] Order ${order.id}: awarded ${total} points from ${result?.awarded?.length ?? 0} rule(s).`);
            return;
        }
        // Legacy fallback: no program seeded → tasa configurable (Fase 1 behavior).
        //
        // Se resuelve ACÁ y no en un `const` de módulo, que es como estaba: la card
        // del admin cambia la tasa en caliente y una constante de import la
        // congelaría hasta el próximo reinicio. `resolvePointsEarnRate` además sanea
        // el valor — antes esta línea aceptaba un `NaN` del entorno y acreditaba
        // `Math.floor(NaN)`, mientras que `scripts/seed-loyalty.ts` sí exigía `> 0`:
        // dos criterios distintos para el mismo número.
        const points = container.resolve(points_1.POINTS_MODULE);
        const legacyPoints = Math.floor(amount * (0, settings_1.resolvePointsEarnRate)());
        if (legacyPoints > 0) {
            await points.earnPoints(order.customer_id, legacyPoints, {
                reference: 'order',
                reference_id: order.id,
                idempotency_key: `earn:order:${order.id}`,
            });
            logger.info(`[Loyalty] Order ${order.id}: awarded ${legacyPoints} points (legacy rate, no program seeded).`);
        }
    }
    catch (error) {
        logger.error(`[Loyalty] Failed to earn points for order ${order.id}: ${error.message}`);
    }
}
exports.config = {
    event: 'order.placed',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JkZXItcGxhY2VkLXBvaW50cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zdWJzY3JpYmVycy9vcmRlci1wbGFjZWQtcG9pbnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQTBCQSwwQ0E2RkM7QUF0SEQscURBQXNFO0FBRXRFLDhDQUFrRDtBQUVsRCxnREFBb0Q7QUFFcEQsMEVBQTZFO0FBQzdFLDBEQUFvRTtBQWtCckQsS0FBSyxVQUFVLHVCQUF1QixDQUFDLEVBQ3BELEtBQUssRUFDTCxTQUFTLEdBQ3NCO0lBQy9CLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO0lBQzlCLElBQUksQ0FBQyxPQUFPO1FBQUUsT0FBTztJQUVyQixNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFTLGlDQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzNFLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBRTVCLGlDQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRXBDLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUM7UUFDMUMsTUFBTSxFQUFFLE9BQU87UUFDZixNQUFNLEVBQUU7WUFDTixJQUFJLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxVQUFVO1lBQzdDLGtCQUFrQixFQUFFLHdCQUF3QjtZQUM1QyxhQUFhLEVBQUUsMkJBQTJCO1lBQzFDLDZCQUE2QixFQUFFLDZCQUE2QjtTQUM3RDtRQUNELE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUU7S0FDekIsQ0FBQyxDQUFpQyxDQUFDO0lBRXBDLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4QixvREFBb0Q7SUFDcEQsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXO1FBQUUsT0FBTztJQUV6Qyw4REFBOEQ7SUFDOUQsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLGFBQWEsRUFBRSxRQUFRLEVBQUUsWUFBWSxDQUFDO0lBQ2hFLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDO0lBQ3hDLElBQUksV0FBVyxLQUFLLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxFQUFFLENBQUM7UUFDL0MsTUFBTSxDQUFDLElBQUksQ0FBQyxnQ0FBZ0MsS0FBSyxDQUFDLEVBQUUseUJBQXlCLENBQUMsQ0FBQztRQUMvRSxPQUFPO0lBQ1QsQ0FBQztJQUVELHlFQUF5RTtJQUN6RSxNQUFNLGFBQWEsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFdBQVcsS0FBSyxJQUFJLENBQUMsQ0FBQztJQUMvRixNQUFNLE1BQU0sR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN2RixJQUFJLE1BQU0sSUFBSSxDQUFDO1FBQUUsT0FBTztJQUV4QixNQUFNLFdBQVcsR0FBRztRQUNsQixHQUFHLElBQUksR0FBRyxDQUNSLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxVQUFVLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQzdGO0tBQ0YsQ0FBQztJQUNGLE1BQU0sYUFBYSxHQUFHO1FBQ3BCLEdBQUcsSUFBSSxHQUFHLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDbEcsQ0FBQztJQUVGLElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQXVCLHdCQUFjLENBQUMsQ0FBQztRQUN4RSxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBRWpELElBQUksT0FBTyxFQUFFLENBQUM7WUFDWix1Q0FBdUM7WUFDdkMsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSwrQ0FBeUIsRUFBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUM7Z0JBQ2hFLEtBQUssRUFBRTtvQkFDTCxXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVc7b0JBQzlCLEtBQUssRUFBRSxVQUFVO29CQUNqQixNQUFNO29CQUNOLFNBQVMsRUFBRSxPQUFPO29CQUNsQixZQUFZLEVBQUUsS0FBSyxDQUFDLEVBQUU7b0JBQ3RCLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxhQUFhLEVBQUUsRUFBRSxJQUFJLElBQUk7b0JBQ2pELFlBQVksRUFBRSxXQUFXO29CQUN6QixjQUFjLEVBQUUsYUFBYTtpQkFDOUI7YUFDRixDQUFDLENBQUM7WUFDSCxNQUFNLEtBQUssR0FBRyxDQUFDLE1BQU0sRUFBRSxPQUFPLElBQUksRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDeEUsTUFBTSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsS0FBSyxDQUFDLEVBQUUsYUFBYSxLQUFLLGdCQUFnQixNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ2xILE9BQU87UUFDVCxDQUFDO1FBRUQsNEVBQTRFO1FBQzVFLEVBQUU7UUFDRiw0RUFBNEU7UUFDNUUsb0VBQW9FO1FBQ3BFLDZFQUE2RTtRQUM3RSx5RUFBeUU7UUFDekUsNkVBQTZFO1FBQzdFLGdEQUFnRDtRQUNoRCxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFzQixzQkFBYSxDQUFDLENBQUM7UUFDckUsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBQSxnQ0FBcUIsR0FBRSxDQUFDLENBQUM7UUFDbEUsSUFBSSxZQUFZLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDckIsTUFBTSxNQUFNLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsWUFBWSxFQUFFO2dCQUN2RCxTQUFTLEVBQUUsT0FBTztnQkFDbEIsWUFBWSxFQUFFLEtBQUssQ0FBQyxFQUFFO2dCQUN0QixlQUFlLEVBQUUsY0FBYyxLQUFLLENBQUMsRUFBRSxFQUFFO2FBQzFDLENBQUMsQ0FBQztZQUNILE1BQU0sQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEtBQUssQ0FBQyxFQUFFLGFBQWEsWUFBWSwyQ0FBMkMsQ0FBQyxDQUFDO1FBQy9HLENBQUM7SUFDSCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FBQyxLQUFLLENBQUMsNkNBQTZDLEtBQUssQ0FBQyxFQUFFLEtBQU0sS0FBZSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDckcsQ0FBQztBQUNILENBQUM7QUFFWSxRQUFBLE1BQU0sR0FBcUI7SUFDdEMsS0FBSyxFQUFFLGNBQWM7Q0FDdEIsQ0FBQyJ9