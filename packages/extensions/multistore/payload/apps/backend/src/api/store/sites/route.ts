import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { DEMO_STORE_MODULE } from '../../../modules/demo-store';
import { ensureDemoStoreTables } from '../../../modules/demo-store/ensure-tables';
import { publicStoreListing } from '../../../modules/demo-store/public-listing';
import { directoryPage } from '../../../modules/demo-store/directory-page';
import multistoreSettings from '../../../modules/app-settings/descriptors/multistore';
import { resolveSettingSync } from '../../../modules/app-settings/resolve';
import { resolveDirectoryDocument } from '../../../modules/demo-store/directory-document';

/** Public projection only: never expose source credentials, gates or test buyers. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  await ensureDemoStoreTables(req.scope);
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);
  const sites: NonNullable<ReturnType<typeof publicStoreListing>>[] = [];
  const take = 100;
  for (let skip = 0; ; skip += take) {
    const rows = await service.listDemoStores({ status: 'ready', is_main: false }, {
      skip, take, order: { name: 'ASC', id: 'ASC' },
      select: ['slug', 'name', 'status', 'is_main', 'canonical_form', 'theme', 'template_code', 'sales_channel_id'],
    });
    for (const row of rows) {
      const listing = publicStoreListing(row);
      if (listing) sites.push(listing);
    }
    if (rows.length < take) break;
  }
  res.setHeader('Cache-Control', 'no-store');
  // Preserve the unpaged contract for sitemap and older storefront clients.
  if (req.query.directory !== '1') { res.json({ sites }); return; }
  const config = resolveDirectoryDocument(resolveSettingSync(multistoreSettings.settings.find(setting => setting.key === 'SITES_HUB_PUCK')!));
  res.json({ ...directoryPage(sites, Number(req.query.offset ?? 0), String(req.query.q ?? '').slice(0, 200)), config });
}
