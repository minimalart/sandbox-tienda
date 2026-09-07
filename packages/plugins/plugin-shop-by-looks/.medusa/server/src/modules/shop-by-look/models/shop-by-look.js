"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopByLook = void 0;
const utils_1 = require("@medusajs/framework/utils");
const shop_by_look_product_1 = require("./shop-by-look-product");
/**
 * ShopByLook — un "look" editorial comprable del home: una imagen protagonista
 * con productos marcados (hotspots) y una lista editable debajo.
 *
 * Segmentación: `sales_channel_ids` / `region_ids` son arrays opcionales; null o
 * vacío significa "todos" (el storefront filtra por el canal/región activos).
 * `placement` es el slot del home donde aparece el bloque.
 */
exports.ShopByLook = utils_1.model.define('shop_by_look', {
    id: utils_1.model
        .id({
        prefix: 'sbl',
    })
        .primaryKey(),
    title: utils_1.model.text(),
    subtitle: utils_1.model.text().nullable(),
    cta_label: utils_1.model.text().nullable(),
    image_url: utils_1.model.text(),
    image_alt: utils_1.model.text().nullable(),
    is_active: utils_1.model.boolean().default(true),
    sort_order: utils_1.model.number().default(0),
    placement: utils_1.model.text().default('after_featured'),
    sales_channel_ids: utils_1.model.json().nullable(),
    region_ids: utils_1.model.json().nullable(),
    metadata: utils_1.model.json().nullable(),
    products: utils_1.model.hasMany(() => shop_by_look_product_1.ShopByLookProduct, {
        mappedBy: 'look',
    }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hvcC1ieS1sb29rLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvc2hvcC1ieS1sb29rL21vZGVscy9zaG9wLWJ5LWxvb2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBQ2xELGlFQUEyRDtBQUUzRDs7Ozs7OztHQU9HO0FBQ1UsUUFBQSxVQUFVLEdBQUcsYUFBSyxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUU7SUFDckQsRUFBRSxFQUFFLGFBQUs7U0FDTixFQUFFLENBQUM7UUFDRixNQUFNLEVBQUUsS0FBSztLQUNkLENBQUM7U0FDRCxVQUFVLEVBQUU7SUFDZixLQUFLLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNuQixRQUFRLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNqQyxTQUFTLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNsQyxTQUFTLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUN2QixTQUFTLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNsQyxTQUFTLEVBQUUsYUFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDeEMsVUFBVSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3JDLFNBQVMsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDO0lBQ2pELGlCQUFpQixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDMUMsVUFBVSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbkMsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsUUFBUSxFQUFFLGFBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsd0NBQWlCLEVBQUU7UUFDL0MsUUFBUSxFQUFFLE1BQU07S0FDakIsQ0FBQztDQUNILENBQUMsQ0FBQyJ9