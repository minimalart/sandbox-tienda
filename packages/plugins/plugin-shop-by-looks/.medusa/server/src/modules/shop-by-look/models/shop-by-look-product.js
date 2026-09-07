"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopByLookProduct = void 0;
const utils_1 = require("@medusajs/framework/utils");
const shop_by_look_1 = require("./shop-by-look");
/**
 * ShopByLookProduct — un producto asociado a un look + su hotspot.
 *
 * `product_id` se guarda como texto (no hay defineLink): el storefront resuelve
 * el producto por la store API, así si el producto se borra el look no se rompe.
 * `variant_id` es opcional: si falta, el usuario elige la variante en storefront.
 * `pos_x` / `pos_y` son porcentajes enteros (0–100) sobre la imagen.
 */
exports.ShopByLookProduct = utils_1.model
    .define('shop_by_look_product', {
    id: utils_1.model
        .id({
        prefix: 'sblp',
    })
        .primaryKey(),
    product_id: utils_1.model.text(),
    variant_id: utils_1.model.text().nullable(),
    pos_x: utils_1.model.number().default(50),
    pos_y: utils_1.model.number().default(50),
    sort_order: utils_1.model.number().default(0),
    look: utils_1.model.belongsTo(() => shop_by_look_1.ShopByLook, {
        mappedBy: 'products',
    }),
})
    .indexes([
    {
        on: ['look_id'],
        where: 'deleted_at IS NULL',
    },
    {
        on: ['product_id'],
        where: 'deleted_at IS NULL',
    },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hvcC1ieS1sb29rLXByb2R1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9zaG9wLWJ5LWxvb2svbW9kZWxzL3Nob3AtYnktbG9vay1wcm9kdWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUNsRCxpREFBNEM7QUFFNUM7Ozs7Ozs7R0FPRztBQUNVLFFBQUEsaUJBQWlCLEdBQUcsYUFBSztLQUNuQyxNQUFNLENBQUMsc0JBQXNCLEVBQUU7SUFDOUIsRUFBRSxFQUFFLGFBQUs7U0FDTixFQUFFLENBQUM7UUFDRixNQUFNLEVBQUUsTUFBTTtLQUNmLENBQUM7U0FDRCxVQUFVLEVBQUU7SUFDZixVQUFVLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUN4QixVQUFVLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNuQyxLQUFLLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7SUFDakMsS0FBSyxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO0lBQ2pDLFVBQVUsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNyQyxJQUFJLEVBQUUsYUFBSyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyx5QkFBVSxFQUFFO1FBQ3RDLFFBQVEsRUFBRSxVQUFVO0tBQ3JCLENBQUM7Q0FDSCxDQUFDO0tBQ0QsT0FBTyxDQUFDO0lBQ1A7UUFDRSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUM7UUFDZixLQUFLLEVBQUUsb0JBQW9CO0tBQzVCO0lBQ0Q7UUFDRSxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUM7UUFDbEIsS0FBSyxFQUFFLG9CQUFvQjtLQUM1QjtDQUNGLENBQUMsQ0FBQyJ9