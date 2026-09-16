import { createHash, randomBytes } from 'node:crypto';
import type { CustomerSession } from '../util/customer-session';

export function checkoutCookieName(context: CustomerSession, cartId: string): string {
  return `_checkout_${createHash('sha256').update(JSON.stringify([context.mode, context.site, cartId])).digest('hex').slice(0, 24)}`;
}

type CheckoutReply = { body: unknown; status: number; newToken?: string };

/** Publish only a capability accepted by the backend. A losing initialization
 * must never overwrite the winning request's cookie, including on errors. */
export async function handleCheckoutSession(input: {
  existingToken?: string;
  bind?: (token: string) => Promise<unknown>;
  request: (token: string) => Promise<Response>;
}): Promise<CheckoutReply> {
  const token = input.existingToken || randomBytes(32).toString('hex');
  let accepted = false;
  const reply = (body: unknown, status: number): CheckoutReply => ({
    body,
    status,
    ...(!input.existingToken && accepted ? { newToken: token } : {}),
  });
  try {
    if (input.bind) {
      await input.bind(token);
      accepted = true;
    }
    const response = await input.request(token);
    // Also support projects without the admin binding endpoint.
    accepted ||= response.ok;
    if (response.status === 404) return reply({ configured: false }, 200);
    return reply(await response.json(), response.status);
  } catch (error) {
    const failure = error as { status?: number; message?: string };
    // A missing optional extension must not disable ordinary checkout.
    if (failure.status === 404) return reply({ configured: false }, 200);
    return reply(
      { message: failure.message || 'No se pudo actualizar el checkout.' },
      failure.status && failure.status >= 400 && failure.status < 600 ? failure.status : 400,
    );
  }
}
