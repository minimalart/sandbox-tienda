import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { resolveSite } from '../../../../lib/multistore/resolve-site';
import { merchantReport } from '../../../../lib/google-merchant-report';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const id = req.params.site;
  const site = await resolveSite(
    req.scope,
    id === 'main' ? { allowMainFallback: true } : { siteId: id }
  );
  if (site.status === 'unknownSite' || (site.status === 'registryAbsent' && id !== 'main'))
    return res.status(404).json({ message: 'Unknown site' });
  try {
    const report = await merchantReport(req.scope, site);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(report.xml);
  } catch {
    return res.status(503).json({ message: 'Product feed unavailable' });
  }
}
