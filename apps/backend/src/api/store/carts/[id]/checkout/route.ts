import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { checkoutErrorResponse } from '../../../../../modules/demo-store/checkout/http';
import { assertCartAccess, beginCheckout, checkoutCart, prepareCheckoutPayment, saveRecipients, sessionFor } from '../../../../../modules/demo-store/checkout/runtime';
import { PersonSchema } from '../../../../../modules/demo-store/checkout/assignments';

const WriteSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('begin') }).strict(),
  z.object({ action: z.literal('prepare'), revision: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal('recipients'), revision: z.number().int().nonnegative(), people: z.array(PersonSchema).max(500), assignments: z.array(z.object({ unit_id: z.string().uuid(), person_id: z.string().uuid() }).strict()).max(2000), global_person_id: z.string().uuid().nullable(), keep_unit_ids: z.array(z.string().uuid()).optional() }).strict(),
]);
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const input = WriteSchema.parse(req.body);
    const cart = await checkoutCart(req.scope, req.params.id as string);
    await assertCartAccess(req, cart, await sessionFor(req.scope, cart.id));
    if (input.action === 'begin') return res.json(await beginCheckout(req, cart));
    if (input.action === 'recipients') return res.json(await saveRecipients(req, cart, input));
    const session = await sessionFor(req.scope, cart.id);
    if (session && session.revision !== input.revision) return res.status(409).json({ code: 'CHECKOUT_REVISION_CONFLICT', message: 'El checkout cambió. Revisá la compra.' });
    await prepareCheckoutPayment(req.scope, cart);
    return res.json({ prepared: true });
  } catch (error) { return checkoutErrorResponse(res, error); }
}
