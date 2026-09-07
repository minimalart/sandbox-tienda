import 'server-only';
import { maskGiftCardCode } from '@repo/shared';
import type { HttpTypes } from '@medusajs/types';

/** Removes monetary gift-card codes before a cart crosses a server boundary. */
export function sanitizeCartGiftCardCodes<T extends HttpTypes.StoreCart | null>(cart: T): T {
  if (!cart) return cart;
  const raw = cart as HttpTypes.StoreCart & {
    gift_cards?: Array<Record<string, unknown> & { code?: string | null }>;
    credit_lines?: Array<Record<string, unknown> & { id?: string; reference?: string | null; reference_id?: string | null; metadata?: Record<string, unknown> | null }>;
  };
  const giftCards = raw.gift_cards?.map(({ code, ...giftCard }) => ({ ...giftCard, masked_code: maskGiftCardCode(code) }));
  const creditLines = raw.credit_lines?.map((line) => {
    if (line.reference !== 'gift-card') return line;
    const metadata = { ...(line.metadata ?? {}) };
    const code = typeof metadata.code === 'string' ? metadata.code : line.reference_id;
    delete metadata.code;
    delete metadata.gift_card_code;
    return { ...line, reference_id: line.id ?? null, metadata: { ...metadata, masked_code: maskGiftCardCode(code) } };
  });
  return { ...raw, ...(giftCards ? { gift_cards: giftCards } : {}), ...(creditLines ? { credit_lines: creditLines } : {}) } as T;
}
