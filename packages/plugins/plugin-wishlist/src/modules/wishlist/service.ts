import { MedusaService } from '@medusajs/framework/utils';
import { Wishlist, WishlistItem } from './models';

class WishlistModuleService extends MedusaService({
  Wishlist,
  WishlistItem,
}) {}

export default WishlistModuleService;
