import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { SpaceConfigurator } from '../../../../../types';
import {
  channelFilter,
  missing,
  priceContext,
  publicCatalog,
  serviceOf,
  storeChannels,
} from '../../../../shared';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const [row] = await serviceOf(req).listSpaceConfigurators(
    { status: 'published', slug: req.params.slug, ...channelFilter(storeChannels(req, true)) },
    { take: 1 }
  );
  if (!row) return missing();
  const configurator = row as unknown as SpaceConfigurator;
  const catalog = await publicCatalog(req, configurator.config, await priceContext(req));
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ configurator: { ...configurator, catalog } });
}
