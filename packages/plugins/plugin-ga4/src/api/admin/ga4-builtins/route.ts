import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { GA4_MODULE } from '../../../modules/ga4';
import Ga4ModuleService from '../../../modules/ga4/service';

import { siteFromRequest } from '../../../lib/multistore/request';


/** `null` = la fila GLOBAL, el fallback de toda tienda sin mapeo propio. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const ga4Service: Ga4ModuleService = req.scope.resolve(GA4_MODULE);
  const builtins = await ga4Service.getBuiltinSettings(await siteOf(req));
  res.status(200).json({ builtins });
}
