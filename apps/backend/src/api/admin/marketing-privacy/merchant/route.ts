import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { merchantReport } from '../../../../lib/google-merchant-report';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const site = await siteFromRequest(req);
  try {
    const { xml: _xml, ...report } = await merchantReport(req.scope, site);
    return res.json({
      ...report,
      feedPath: `/feeds/google-merchant/${'site' in site ? site.site.id : 'main'}`,
    });
  } catch {
    return res
      .status(409)
      .json({
        message: 'Check store, region, channel, stock location and enabled feed configuration',
      });
  }
}
