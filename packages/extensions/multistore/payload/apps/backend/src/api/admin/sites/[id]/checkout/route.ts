import { siteFromRequest } from '../../../../../lib/multistore/request';
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { authorizeCheckoutAdmin, checkoutErrorResponse } from '../../../../../modules/demo-store/checkout/http';
import { readPolicy, writePolicy } from '../../../../../modules/demo-store/checkout/runtime';
import { CheckoutPolicySchema } from '../../../../../modules/demo-store/checkout/policy';

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await authorizeCheckoutAdmin(req, req.params.id as string, false, await siteFromRequest(req));
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(await readPolicy(req.scope, req.params.id as string));
}
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await authorizeCheckoutAdmin(req, req.params.id as string, false, await siteFromRequest(req));
  try {
    const input = z.object({ policy: CheckoutPolicySchema, expected_version: z.string().length(64) }).strict().parse(req.body);
    res.json(await writePolicy(req.scope, req.params.id as string, input.policy, input.expected_version));
  } catch (error) { checkoutErrorResponse(res, error); }
}
