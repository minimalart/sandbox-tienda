import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { WISHLIST_MODULE } from '../../../../../modules/wishlist';
import type WishlistModuleService from '../../../../../modules/wishlist/service';

// GET /store/customers/me/wishlist — the authenticated customer's wishlist.
// Mounted under /store/customers/me so the core applies customer auth.
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const service = req.scope.resolve<WishlistModuleService>(WISHLIST_MODULE);

  const wishlists = await service.listWishlists(
    { customer_id: customerId },
    { relations: ['items'] },
  );
  const wishlist = wishlists[0] as ({ id: string; items?: unknown[] }) | undefined;

  res.status(200).json({
    wishlist: {
      id: wishlist?.id ?? null,
      items: wishlist?.items ?? [],
    },
  });
}
