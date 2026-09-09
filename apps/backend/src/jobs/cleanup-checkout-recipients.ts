import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { beginCartMutation, endCartMutation, invalidateCheckoutPayment, checkoutCart } from '../modules/demo-store/checkout/runtime';

export default async function cleanupCheckoutRecipients(container: MedusaContainer) {
  const pg: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY);
  // Keyset pagination prevents retained orders from starving abandoned carts.
  let cursor = '';
  for (;;) {
    const expired = await pg('site_checkout_session').where('expires_at', '<', new Date()).where('cart_id', '>', cursor).where({ finalizing: false }).orderBy('cart_id').limit(100);
    if (!expired.length) break;
    for (const row of expired) {
      cursor = row.cart_id;
      let token: string | null = null;
      try {
        token = await beginCartMutation(container, row.cart_id);
        const { data } = await query.graph({ entity: 'order_cart', fields: ['order_id'], filters: { cart_id: row.cart_id } });
        if (data.length) continue;
        // Cancel external pending sessions before removing their snapshot.
        const cart = await checkoutCart(container, row.cart_id);
        await invalidateCheckoutPayment(container, cart);
        await pg.transaction(async (trx: any) => {
          const current = await trx('site_checkout_session').where({ cart_id: row.cart_id, mutation_token: token, finalizing: false }).forUpdate().first();
          if (!current || new Date(current.expires_at).getTime() >= Date.now()) return;
          await trx('site_checkout_snapshot').where({ cart_id: row.cart_id }).delete();
          await trx('site_checkout_session').where({ cart_id: row.cart_id }).delete();
        });
      } catch {
        // Retry next run; provider failures must never erase payment evidence.
      } finally {
        await endCartMutation(container, row.cart_id, token);
      }
    }
  }
}
export const config = { name: 'cleanup-checkout-recipients', schedule: '17 * * * *' };
