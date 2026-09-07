"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.DELETE = DELETE;
const wishlist_1 = require("../../../../../../modules/wishlist");
async function getOrCreateWishlist(service, customerId) {
    const existing = await service.listWishlists({ customer_id: customerId });
    const found = existing[0];
    if (found)
        return found;
    return service.createWishlists({ customer_id: customerId });
}
// POST /store/customers/me/wishlist/items — add a variant to the wishlist.
// Body matches the storefront contract: { productId, productVariantId, quantity }.
async function POST(req, res) {
    const customerId = req.auth_context.actor_id;
    const productId = req.body?.productId;
    const productVariantId = req.body?.productVariantId;
    const quantity = typeof req.body?.quantity === 'number' ? req.body.quantity : 1;
    if (!productId || typeof productId !== 'string') {
        res.status(400).json({ message: 'productId is required' });
        return;
    }
    if (!productVariantId || typeof productVariantId !== 'string') {
        res.status(400).json({ message: 'productVariantId is required' });
        return;
    }
    const service = req.scope.resolve(wishlist_1.WISHLIST_MODULE);
    const wishlist = await getOrCreateWishlist(service, customerId);
    const existing = await service.listWishlistItems({
        wishlist_id: wishlist.id,
        product_id: productId,
        product_variant_id: productVariantId,
    });
    if (existing.length === 0) {
        await service.createWishlistItems({
            wishlist_id: wishlist.id,
            product_id: productId,
            product_variant_id: productVariantId,
            quantity,
        });
    }
    // Return the full item list so the storefront proxy can confirm the add
    // without a follow-up GET.
    const items = await service.listWishlistItems({ wishlist_id: wishlist.id });
    res.status(200).json({ wishlist_id: wishlist.id, items });
}
// DELETE /store/customers/me/wishlist/items?productId=&productVariantId= — remove a variant.
async function DELETE(req, res) {
    const customerId = req.auth_context.actor_id;
    const productId = req.query.productId;
    const productVariantId = req.query.productVariantId;
    if (!productId || !productVariantId) {
        res.status(400).json({ message: 'productId and productVariantId are required' });
        return;
    }
    const service = req.scope.resolve(wishlist_1.WISHLIST_MODULE);
    const wishlists = await service.listWishlists({ customer_id: customerId });
    const wishlist = wishlists[0];
    if (!wishlist) {
        res.status(200).json({ deleted: false });
        return;
    }
    const items = (await service.listWishlistItems({
        wishlist_id: wishlist.id,
        product_id: productId,
        product_variant_id: productVariantId,
    }));
    if (items.length > 0) {
        await service.deleteWishlistItems(items.map((item) => item.id));
    }
    res.status(200).json({ deleted: items.length > 0 });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2N1c3RvbWVycy9tZS93aXNobGlzdC9pdGVtcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWtCQSxvQkE2Q0M7QUFHRCx3QkE4QkM7QUEvRkQsaUVBQXFFO0FBS3JFLEtBQUssVUFBVSxtQkFBbUIsQ0FDaEMsT0FBOEIsRUFDOUIsVUFBa0I7SUFFbEIsTUFBTSxRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMsYUFBYSxDQUFDLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDMUUsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzFCLElBQUksS0FBSztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ3hCLE9BQU8sT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO0FBQzlELENBQUM7QUFFRCwyRUFBMkU7QUFDM0UsbUZBQW1GO0FBQzVFLEtBQUssVUFBVSxJQUFJLENBQ3hCLEdBSUUsRUFDRixHQUFtQjtJQUVuQixNQUFNLFVBQVUsR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztJQUM3QyxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQztJQUN0QyxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLENBQUM7SUFDcEQsTUFBTSxRQUFRLEdBQUcsT0FBTyxHQUFHLENBQUMsSUFBSSxFQUFFLFFBQVEsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFaEYsSUFBSSxDQUFDLFNBQVMsSUFBSSxPQUFPLFNBQVMsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUNoRCxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxDQUFDLENBQUM7UUFDM0QsT0FBTztJQUNULENBQUM7SUFDRCxJQUFJLENBQUMsZ0JBQWdCLElBQUksT0FBTyxnQkFBZ0IsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUM5RCxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxDQUFDLENBQUM7UUFDbEUsT0FBTztJQUNULENBQUM7SUFFRCxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBd0IsMEJBQWUsQ0FBQyxDQUFDO0lBQzFFLE1BQU0sUUFBUSxHQUFHLE1BQU0sbUJBQW1CLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBRWhFLE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLGlCQUFpQixDQUFDO1FBQy9DLFdBQVcsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUN4QixVQUFVLEVBQUUsU0FBUztRQUNyQixrQkFBa0IsRUFBRSxnQkFBZ0I7S0FDckMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQzFCLE1BQU0sT0FBTyxDQUFDLG1CQUFtQixDQUFDO1lBQ2hDLFdBQVcsRUFBRSxRQUFRLENBQUMsRUFBRTtZQUN4QixVQUFVLEVBQUUsU0FBUztZQUNyQixrQkFBa0IsRUFBRSxnQkFBZ0I7WUFDcEMsUUFBUTtTQUNULENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCx3RUFBd0U7SUFDeEUsMkJBQTJCO0lBQzNCLE1BQU0sS0FBSyxHQUFHLE1BQU0sT0FBTyxDQUFDLGlCQUFpQixDQUFDLEVBQUUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRTVFLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUM1RCxDQUFDO0FBRUQsNkZBQTZGO0FBQ3RGLEtBQUssVUFBVSxNQUFNLENBQUMsR0FBK0IsRUFBRSxHQUFtQjtJQUMvRSxNQUFNLFVBQVUsR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztJQUM3QyxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFNBQStCLENBQUM7SUFDNUQsTUFBTSxnQkFBZ0IsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLGdCQUFzQyxDQUFDO0lBRTFFLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3BDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLDZDQUE2QyxFQUFFLENBQUMsQ0FBQztRQUNqRixPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUF3QiwwQkFBZSxDQUFDLENBQUM7SUFDMUUsTUFBTSxTQUFTLEdBQUcsTUFBTSxPQUFPLENBQUMsYUFBYSxDQUFDLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDM0UsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTlCLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNkLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDekMsT0FBTztJQUNULENBQUM7SUFFRCxNQUFNLEtBQUssR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGlCQUFpQixDQUFDO1FBQzdDLFdBQVcsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUN4QixVQUFVLEVBQUUsU0FBUztRQUNyQixrQkFBa0IsRUFBRSxnQkFBZ0I7S0FDckMsQ0FBQyxDQUF5QixDQUFDO0lBRTVCLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUNyQixNQUFNLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsRSxDQUFDO0lBRUQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3RELENBQUMifQ==