import 'server-only';
import { getMedusaSDK } from '@lib/config';
import { getAuthHeaders, getCartId } from '@lib/data/cookies';
import type { HttpTypes } from '@medusajs/types';

/** Resolves an opaque application id inside the current cart, server-side only. */
export async function resolveCartGiftCardCode(applicationId: string): Promise<string | null> {
  const cartId = await getCartId();
  if (!cartId) return null;
  const tenantSdk = await getMedusaSDK();
  const response = await tenantSdk.client.fetch<HttpTypes.StoreCartResponse>(`/store/carts/${cartId}`, {
    method: 'GET',
    query: { fields: '+gift_cards,+credit_lines,+credit_lines.metadata,+credit_lines.reference,+credit_lines.reference_id' },
    headers: await getAuthHeaders(),
    cache: 'no-store',
  });
  const raw = response.cart as HttpTypes.StoreCart & {
    gift_cards?: Array<{ id?: string; code?: string | null }>;
    credit_lines?: Array<{ id?: string; reference?: string | null; reference_id?: string | null; metadata?: Record<string, unknown> | null }>;
  };
  const giftCard = raw.gift_cards?.find((entry) => entry.id === applicationId);
  if (giftCard?.code) return giftCard.code;
  const creditLine = raw.credit_lines?.find((entry) => entry.id === applicationId && entry.reference === 'gift-card');
  const code = creditLine?.metadata?.code ?? creditLine?.reference_id;
  return typeof code === 'string' && code.trim() ? code : null;
}
