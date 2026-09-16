import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { DEMO_STORE_MODULE } from '../../../../modules/demo-store';
import { ensureDemoStoreTables } from '../../../../modules/demo-store/ensure-tables';
import { isReservedSlug, SLUG_PATTERN, SLUG_MIN_LENGTH, SLUG_MAX_LENGTH } from '../../../../modules/demo-store/reserved-slugs';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug) || isReservedSlug(slug)) {
    res.json({ available: false, message: 'Elegí un subdominio válido, sin espacios ni nombres reservados.' });
    return;
  }
  await ensureDemoStoreTables(req.scope);
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);
  const [existing] = await service.listDemoStores({ slug }, { take: 1, select: ['id'] });
  res.json({ available: !existing, message: existing ? 'Ese subdominio ya está en uso.' : 'Subdominio disponible.' });
}
