"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftCardDesign = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.GiftCardDesign = utils_1.model
    .define('gift_card_design', {
    id: utils_1.model.id({ prefix: 'gcdesign' }).primaryKey(),
    public_id: utils_1.model.text(),
    name: utils_1.model.text(),
    occasion: utils_1.model.enum([
        'general',
        'birthday',
        'thanks',
        'congratulations',
        'holidays',
        'brand',
    ]).default('general'),
    desktop_image_url: utils_1.model.text(),
    mobile_image_url: utils_1.model.text().nullable(),
    text_color: utils_1.model.text().default('#FFFFFF'),
    content_position: utils_1.model.enum([
        'top_left', 'top_center', 'top_right',
        'center_left', 'center', 'center_right',
        'bottom_left', 'bottom_center', 'bottom_right',
    ]).default('center'),
    active: utils_1.model.boolean().default(true),
    sort_order: utils_1.model.number().default(0),
    metadata: utils_1.model.json().nullable(),
    /**
     * La tienda dueña del diseño. `NULL` = diseño GLOBAL, disponible en todas.
     *
     * Es branding: la tarjeta lleva la marca de la tienda que la vende. Un diseño sin
     * tienda es de la instancia —el `brand-default` sembrado— y por eso `empty: 'all'`:
     * esconderlo dejaría a una tienda sin ningún diseño disponible.
     */
    site_id: utils_1.model.text().nullable(),
})
    .indexes([
    // DOS parciales: en Postgres `NULL != NULL`.
    { on: ['public_id'], unique: true, where: 'site_id IS NULL AND deleted_at IS NULL' },
    { on: ['site_id', 'public_id'], unique: true, where: 'site_id IS NOT NULL AND deleted_at IS NULL' },
    { on: ['site_id'] },
    { on: ['active', 'sort_order'] },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2lmdC1jYXJkLWRlc2lnbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2dpZnQtY2FyZC1leHBlcmllbmNlL21vZGVscy9naWZ0LWNhcmQtZGVzaWduLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUVyQyxRQUFBLGNBQWMsR0FBRyxhQUFLO0tBQ2hDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRTtJQUMxQixFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUNqRCxTQUFTLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUN2QixJQUFJLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNsQixRQUFRLEVBQUUsYUFBSyxDQUFDLElBQUksQ0FBQztRQUNuQixTQUFTO1FBQ1QsVUFBVTtRQUNWLFFBQVE7UUFDUixpQkFBaUI7UUFDakIsVUFBVTtRQUNWLE9BQU87S0FDUixDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQztJQUNyQixpQkFBaUIsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQy9CLGdCQUFnQixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDekMsVUFBVSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO0lBQzNDLGdCQUFnQixFQUFFLGFBQUssQ0FBQyxJQUFJLENBQUM7UUFDM0IsVUFBVSxFQUFFLFlBQVksRUFBRSxXQUFXO1FBQ3JDLGFBQWEsRUFBRSxRQUFRLEVBQUUsY0FBYztRQUN2QyxhQUFhLEVBQUUsZUFBZSxFQUFFLGNBQWM7S0FDL0MsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUM7SUFDcEIsTUFBTSxFQUFFLGFBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0lBQ3JDLFVBQVUsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNyQyxRQUFRLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNqQzs7Ozs7O09BTUc7SUFDSCxPQUFPLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNqQyxDQUFDO0tBQ0QsT0FBTyxDQUFDO0lBQ1AsNkNBQTZDO0lBQzdDLEVBQUUsRUFBRSxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsd0NBQXdDLEVBQUU7SUFDcEYsRUFBRSxFQUFFLEVBQUUsQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsNENBQTRDLEVBQUU7SUFDbkcsRUFBRSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsRUFBRTtJQUNuQixFQUFFLEVBQUUsRUFBRSxDQUFDLFFBQVEsRUFBRSxZQUFZLENBQUMsRUFBRTtDQUNqQyxDQUFDLENBQUMifQ==