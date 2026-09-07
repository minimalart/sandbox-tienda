import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { PaginationSchema } from '../../../../validation';
import { adminProductLookup, parse } from '../../../shared';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json(await adminProductLookup(req, parse(PaginationSchema, req.query)));
}
