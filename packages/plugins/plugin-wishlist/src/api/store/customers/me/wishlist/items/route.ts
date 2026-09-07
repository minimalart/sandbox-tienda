import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { WISHLIST_MODULE } from '../../../../../../modules/wishlist';
import type WishlistModuleService from '../../../../../../modules/wishlist/service';

type WishlistItemRecord = { id: string };

async function getOrCreateWishlist(
  service: WishlistModuleService,
  customerId: string,
): Promise<{ id: string }> {
  const existing = await service.listWishlists({ customer_id: customerId });
  const found = existing[0];
  if (found) return found;
  return service.createWishlists({ customer_id: customerId });
}

// POST /store/customers/me/wishlist/items — add a variant to the wishlist.
// Body matches the storefront contract: { productId, productVariantId, quantity }.
export async function POST(
  req: AuthenticatedMedusaRequest<{
    productId?: string;
    productVariantId?: string;
    quantity?: number;
  }>,
  res: MedusaResponse,
): Promise<void> {
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

  const service = req.scope.resolve<WishlistModuleService>(WISHLIST_MODULE);
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
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const productId = req.query.productId as string | undefined;
  const productVariantId = req.query.productVariantId as string | undefined;

  if (!productId || !productVariantId) {
    res.status(400).json({ message: 'productId and productVariantId are required' });
    return;
  }

  const service = req.scope.resolve<WishlistModuleService>(WISHLIST_MODULE);
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
  })) as WishlistItemRecord[];

  if (items.length > 0) {
    await service.deleteWishlistItems(items.map((item) => item.id));
  }

  res.status(200).json({ deleted: items.length > 0 });
}
