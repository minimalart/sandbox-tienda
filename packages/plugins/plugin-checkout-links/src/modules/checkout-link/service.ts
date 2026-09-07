import { MedusaService } from '@medusajs/framework/utils';
import { randomBytes } from 'crypto';
import { CheckoutLink } from './models/checkout-link';
import {
  CheckoutLinkStatus,
  type CheckoutLinkItem,
  type ResolvedCheckoutLink,
} from './types';

class CheckoutLinkModuleService extends MedusaService({
  CheckoutLink,
}) {
  /**
   * URL-safe opaque token. ~11 chars from 8 random bytes (base64url, no
   * padding). Collisions are vanishingly unlikely; the workflow retries on the
   * unique constraint just in case.
   */
  generateToken(): string {
    return randomBytes(8).toString('base64url');
  }

  private isExpired(link: { expires_at?: Date | string | null }): boolean {
    if (!link.expires_at) return false;
    return new Date(link.expires_at) <= new Date();
  }

  /**
   * Resolves a token to the public payload needed to build the cart, or null
   * when the link is missing, disabled, expired, or a consumed single-use link.
   */
  async resolveByToken(token: string): Promise<ResolvedCheckoutLink | null> {
    if (!token) return null;

    const [link] = await this.listCheckoutLinks({ token, deleted_at: null });

    if (!link) return null;
    if (link.status === CheckoutLinkStatus.DISABLED) return null;
    if (this.isExpired(link)) return null;
    if (link.single_use && link.status === CheckoutLinkStatus.USED) return null;

    return {
      items: (link.items as unknown as CheckoutLinkItem[]) ?? [],
      country_code: link.country_code,
      region_id: link.region_id ?? null,
      sales_channel_id: link.sales_channel_id ?? null,
      email: link.email ?? null,
      shipping_address: (link.shipping_address as any) ?? null,
      promo_codes: (link.promo_codes as unknown as string[]) ?? [],
    };
  }

  /**
   * Marks a link as consumed after an order is placed. Increments the counter
   * and, for single-use links, flips the status to `used`.
   */
  async markUsed(token: string): Promise<void> {
    const [link] = await this.listCheckoutLinks({ token, deleted_at: null });
    if (!link) return;

    await (this as any).updateCheckoutLinks({
      id: link.id,
      used_count: (link.used_count ?? 0) + 1,
      ...(link.single_use ? { status: CheckoutLinkStatus.USED } : {}),
    });
  }
}

export default CheckoutLinkModuleService;
