"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const payment_benefits_1 = require("../../../modules/payment-benefits");
/** Forma pública (lean) de un beneficio para el storefront. */
function toPublic(b) {
    return {
        id: b.id,
        provider_code: b.provider_code,
        source: b.source,
        title: b.title,
        description: b.description,
        benefit_type: b.benefit_type,
        discount_type: b.discount_type,
        discount_value: b.discount_value,
        max_installments: b.max_installments,
        max_refund: b.max_refund,
        minimum_amount: b.minimum_amount,
        maximum_amount: b.maximum_amount,
        priority: b.priority,
        conditions: b.conditions,
    };
}
/**
 * Beneficios de pago aplicables y vigentes, scopeados por sales channel.
 * Con `product_id` (+ collection/category/brand) devuelve solo los que aplican
 * al producto; sin él, todos los activos del canal (para el checkout).
 * Nunca modifica el precio: es informativo (PRD §14).
 */
async function GET(req, res) {
    const service = req.scope.resolve(payment_benefits_1.PAYMENT_BENEFITS_MODULE);
    const q = req.query;
    const salesChannelId = q.sales_channel_id ?? null;
    const productId = q.product_id;
    let benefits;
    if (productId) {
        const categoryIds = Array.isArray(q.category_id)
            ? q.category_id
            : q.category_id
                ? [q.category_id]
                : [];
        benefits = await service.getBenefitsForProduct(productId, {
            salesChannelId,
            collectionId: q.collection_id ?? null,
            categoryIds,
            brandId: q.brand_id ?? null,
        });
    }
    else {
        benefits = await service.listActiveBenefits({ salesChannelId });
    }
    res.json({ payment_benefits: benefits.map(toPublic) });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL3BheW1lbnQtYmVuZWZpdHMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUErQkEsa0JBeUJDO0FBdkRELHdFQUE0RTtBQUk1RSwrREFBK0Q7QUFDL0QsU0FBUyxRQUFRLENBQUMsQ0FBZ0I7SUFDaEMsT0FBTztRQUNMLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRTtRQUNSLGFBQWEsRUFBRSxDQUFDLENBQUMsYUFBYTtRQUM5QixNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU07UUFDaEIsS0FBSyxFQUFFLENBQUMsQ0FBQyxLQUFLO1FBQ2QsV0FBVyxFQUFFLENBQUMsQ0FBQyxXQUFXO1FBQzFCLFlBQVksRUFBRSxDQUFDLENBQUMsWUFBWTtRQUM1QixhQUFhLEVBQUUsQ0FBQyxDQUFDLGFBQWE7UUFDOUIsY0FBYyxFQUFFLENBQUMsQ0FBQyxjQUFjO1FBQ2hDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxnQkFBZ0I7UUFDcEMsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVO1FBQ3hCLGNBQWMsRUFBRSxDQUFDLENBQUMsY0FBYztRQUNoQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLGNBQWM7UUFDaEMsUUFBUSxFQUFFLENBQUMsQ0FBQyxRQUFRO1FBQ3BCLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVTtLQUN6QixDQUFDO0FBQ0osQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0ksS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUErQiwwQ0FBdUIsQ0FBQyxDQUFDO0lBQ3pGLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxLQUFzRCxDQUFDO0lBRXJFLE1BQU0sY0FBYyxHQUFJLENBQUMsQ0FBQyxnQkFBdUMsSUFBSSxJQUFJLENBQUM7SUFDMUUsTUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDLFVBQWdDLENBQUM7SUFFckQsSUFBSSxRQUF5QixDQUFDO0lBQzlCLElBQUksU0FBUyxFQUFFLENBQUM7UUFDZCxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUM7WUFDOUMsQ0FBQyxDQUFFLENBQUMsQ0FBQyxXQUF3QjtZQUM3QixDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVc7Z0JBQ2IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQXFCLENBQUM7Z0JBQzNCLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDVCxRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMscUJBQXFCLENBQUMsU0FBUyxFQUFFO1lBQ3hELGNBQWM7WUFDZCxZQUFZLEVBQUcsQ0FBQyxDQUFDLGFBQW9DLElBQUksSUFBSTtZQUM3RCxXQUFXO1lBQ1gsT0FBTyxFQUFHLENBQUMsQ0FBQyxRQUErQixJQUFJLElBQUk7U0FDcEQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztTQUFNLENBQUM7UUFDTixRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMsa0JBQWtCLENBQUMsRUFBRSxjQUFjLEVBQUUsQ0FBQyxDQUFDO0lBQ2xFLENBQUM7SUFFRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsZ0JBQWdCLEVBQUUsUUFBUSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDekQsQ0FBQyJ9