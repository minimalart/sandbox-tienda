import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { Modules } from '@medusajs/framework/utils';
import { createPreview, PreviewInput, previewOrigin, type PreviewCache } from '../../../../../lib/home-preview';
import { DEMO_STORE_MODULE } from '../../../../../modules/demo-store';

const supported = new Set(['Hero', 'RichText', 'ImageBlock', 'CTA', 'Spacer', 'Categorias', 'ProductosDestacados', 'Combos', 'BannerPromo', 'Blog', 'MasCategorias', 'Banners', 'Marcas', 'Videos', 'ShopByLook', 'CampaignHero', 'BundlesGrid', 'TemplateSection']);
async function context(req: MedusaRequest) {
  const site = await (req.scope.resolve(DEMO_STORE_MODULE) as any).retrieveDemoStore(req.params.id);
  const regions = await (req.scope.resolve(Modules.REGION) as any).listRegions(site.region_id ? { id: site.region_id } : {}, { relations: ['countries'] });
  const countries = [...new Set<string>(regions.flatMap((r: any) => (r.countries || []).map((c: any) => c.iso_2)))].filter(Boolean).sort();
  return { site, countries };
}
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  const { site, countries } = await context(req);
  return res.json({ sites: [{ id: site.id, name: site.name, slug: site.is_main ? '' : site.slug }], countries });
}
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  const parsed = PreviewInput.safeParse(req.body);
  if (!parsed.success || JSON.stringify(req.body).length > 500_000) return res.status(400).json({ message: 'Invalid preview document' });
  const input = parsed.data;
  const { site, countries } = await context(req);
  if (input.site_id !== site.id) return res.status(403).json({ message: 'Preview must belong to the edited store' });
  if (!countries.includes(input.country_code)) return res.status(400).json({ message: 'Country is not configured for this store' });
  if (input.puck_data.content.some(b => !supported.has(b.type)) || (input.mode === 'block' && input.puck_data.content.length !== 1)) return res.status(400).json({ message: 'Unsupported home block' });
  const origin = previewOrigin(input.parent_origin, [...(process.env.ADMIN_CORS || '').split(','), req.protocol + '://' + req.get('host')]);
  if (!origin) return res.status(400).json({ message: 'Preview origin is not allowed' });
  try {
    const result = await createPreview(req.scope.resolve(Modules.CACHE) as unknown as PreviewCache, {
      home_id: site.id, site_id: site.id, site_slug: site.is_main ? '' : site.slug,
      country_code: input.country_code, parent_origin: origin, language: input.language,
      mode: input.mode, puck_data: input.puck_data,
    });
    return res.status(201).json(result);
  } catch { return res.status(503).json({ message: 'Preview storage is unavailable' }); }
}
