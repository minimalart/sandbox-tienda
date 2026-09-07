"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShopByLookStep = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const shop_by_look_1 = require("../../modules/shop-by-look");
exports.createShopByLookStep = (0, workflows_sdk_1.createStep)('create-shop-by-look-step', async (input, { container }) => {
    const service = container.resolve(shop_by_look_1.SHOP_BY_LOOK_MODULE);
    const { products, ...lookData } = input;
    // model.json() tipa los arrays (sales_channel_ids/region_ids) como
    // Record<string, unknown>; el cast evita el falso conflicto de tipos.
    const look = await service.createShopByLooks(lookData);
    if (products?.length) {
        await service.createShopByLookProducts(products.map((p) => ({
            product_id: p.product_id,
            variant_id: p.variant_id ?? null,
            pos_x: p.pos_x ?? 50,
            pos_y: p.pos_y ?? 50,
            sort_order: p.sort_order ?? 0,
            look_id: look.id,
        })));
    }
    const created = await service.retrieveShopByLook(look.id, {
        relations: ['products'],
    });
    return new workflows_sdk_1.StepResponse(created, look.id);
}, async (lookId, { container }) => {
    if (!lookId) {
        return;
    }
    const service = container.resolve(shop_by_look_1.SHOP_BY_LOOK_MODULE);
    // FK on delete cascade removes child products.
    await service.deleteShopByLooks(lookId);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLXNob3AtYnktbG9vay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3Mvc3RlcHMvY3JlYXRlLXNob3AtYnktbG9vay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxRUFBNkU7QUFDN0UsNkRBQWlFO0FBMEJwRCxRQUFBLG9CQUFvQixHQUFHLElBQUEsMEJBQVUsRUFDNUMsMEJBQTBCLEVBQzFCLEtBQUssRUFBRSxLQUFnQyxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUN4RCxNQUFNLE9BQU8sR0FBNEIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxrQ0FBbUIsQ0FBQyxDQUFDO0lBRWhGLE1BQU0sRUFBRSxRQUFRLEVBQUUsR0FBRyxRQUFRLEVBQUUsR0FBRyxLQUFLLENBQUM7SUFFeEMsbUVBQW1FO0lBQ25FLHNFQUFzRTtJQUN0RSxNQUFNLElBQUksR0FBRyxNQUFNLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxRQUFlLENBQUMsQ0FBQztJQUU5RCxJQUFJLFFBQVEsRUFBRSxNQUFNLEVBQUUsQ0FBQztRQUNyQixNQUFNLE9BQU8sQ0FBQyx3QkFBd0IsQ0FDcEMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNuQixVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVU7WUFDeEIsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLElBQUksSUFBSTtZQUNoQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFFO1lBQ3BCLEtBQUssRUFBRSxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUU7WUFDcEIsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLElBQUksQ0FBQztZQUM3QixPQUFPLEVBQUUsSUFBSSxDQUFDLEVBQUU7U0FDakIsQ0FBQyxDQUFDLENBQ0osQ0FBQztJQUNKLENBQUM7SUFFRCxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFO1FBQ3hELFNBQVMsRUFBRSxDQUFDLFVBQVUsQ0FBQztLQUN4QixDQUFDLENBQUM7SUFFSCxPQUFPLElBQUksNEJBQVksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzVDLENBQUMsRUFDRCxLQUFLLEVBQUUsTUFBTSxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUM5QixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDWixPQUFPO0lBQ1QsQ0FBQztJQUNELE1BQU0sT0FBTyxHQUE0QixTQUFTLENBQUMsT0FBTyxDQUFDLGtDQUFtQixDQUFDLENBQUM7SUFDaEYsK0NBQStDO0lBQy9DLE1BQU0sT0FBTyxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzFDLENBQUMsQ0FDRixDQUFDIn0=