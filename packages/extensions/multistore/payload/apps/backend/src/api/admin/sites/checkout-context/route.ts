import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';
import { bindCartContext } from '../../../../modules/demo-store/checkout/runtime';
import { checkoutErrorResponse } from '../../../../modules/demo-store/checkout/http';

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  if (!req.auth_context?.actor_id) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, 'Autenticación de servidor requerida.');
  try {
    const input = z.object({ cart_id: z.string().min(1), site_slug: z.string().min(1).nullable(), mode: z.enum(['b2b', 'b2c']), access_token: z.string().min(32).max(200) }).strict().parse(req.body);
    await bindCartContext(req.scope, input.cart_id, input.site_slug, input.mode, input.access_token);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ bound: true });
  } catch (error) { checkoutErrorResponse(res, error); }
}
