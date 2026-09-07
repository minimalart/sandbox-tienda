import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { BLOG_MODULE } from '../../../modules/blog';
import type BlogModuleService from '../../../modules/blog/service';

import { siteFromRequest } from '../../../lib/multistore/request';


/** `null` = la fila GLOBAL, el fallback de toda tienda sin config propia. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

const UpdateBlogSettings = z.object({
  section_name: z.string().min(1).optional(),
  show_search: z.boolean().optional(),
  show_categories: z.boolean().optional(),
  posts_per_page: z.number().int().min(1).max(100).optional(),
  default_seo_title: z.string().optional().nullable(),
  default_seo_description: z.string().optional().nullable(),
});

/** GET /admin/blog-settings — singleton config (created with defaults on first read). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    const blog_settings = await service.getSettings(await siteOf(req));
    return res.status(200).json({ blog_settings });
  } catch (error) {
    console.error('[Admin BlogSettings] Error reading settings:', error);
    return res.status(500).json({ message: 'Error fetching blog settings' });
  }
}

/** POST /admin/blog-settings — update the singleton config. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const validated = UpdateBlogSettings.parse(req.body);
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    // Ver la nota de comments/settings: actualizar la fila que devolvió el GET
    // escribiría la configuración global cuando la tienda no tiene la suya.
    const blog_settings = await service.upsertSettingsForSite(await siteOf(req), validated as Record<string, unknown>);
    return res.status(200).json({ blog_settings });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error updating blog settings';
    return res.status(400).json({ message });
  }
}
