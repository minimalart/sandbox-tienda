import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../lib/multistore/request';
import { siteDefaults, siteFilter } from '../../../lib/multistore/scope';
import { LANDING_PAGE_SITE_SCOPE } from '../../../modules/landing-page/site-scope';
import { LANDING_PAGE_MODULE } from '../../../modules/landing-page';
import type LandingPageModuleService from '../../../modules/landing-page/service';
import type { CreateLandingPageInput } from '../../../modules/landing-page/types';
import { createLandingPageWorkflow } from '../../../workflows/create-landing-page';
import { PostAdminCreateLandingPage } from './validators';

/**
 * GET /admin/landing-pages — paginated list (limit, offset, status, q).
 * `q` matches title/slug case-insensitively. Returns
 * { landing_pages, count, limit, offset }, newest update first.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: LandingPageModuleService = req.scope.resolve(
      LANDING_PAGE_MODULE,
    );
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const status =
      typeof req.query.status === 'string' ? req.query.status : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const filters: Record<string, unknown> = {};
    if (status) {
      filters.status = status;
    }
    if (q) {
      filters.$or = [
        { title: { $ilike: `%${q}%` } },
        { slug: { $ilike: `%${q}%` } },
      ];
    }

    const resolution = await siteFromRequest(req);
    Object.assign(filters, await siteFilter(req.scope, resolution, LANDING_PAGE_SITE_SCOPE));

    const [landing_pages, count] = await service.listAndCountLandingPages(
      filters,
      { skip: offset, take: limit, order: { updated_at: 'DESC' } },
    );

    return res.status(200).json({ landing_pages, count, limit, offset });
  } catch (error) {
    console.error('[Admin LandingPages] Error listing landing pages:', error);
    return res.status(500).json({ message: 'Error fetching landing pages' });
  }
}

/**
 * POST /admin/landing-pages — create a landing page (zod-validated, via
 * workflow). Slug is generated from the title when omitted and de-duplicated.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const validated = PostAdminCreateLandingPage.parse(req.body);
    const userId = (req as { auth_context?: { actor_id?: string } })
      .auth_context?.actor_id;

    /**
     * Los defaults van PRIMERO: un `sales_channel_id` explícito en el body gana.
     * Al revés, el default pisaría siempre y el campo del formulario sería
     * decorativo.
     */
    const { result } = await createLandingPageWorkflow(req.scope).run({
      input: {
        ...siteDefaults(await siteFromRequest(req), LANDING_PAGE_SITE_SCOPE),
        ...validated,
        created_by: userId,
      } as unknown as CreateLandingPageInput,
    });

    return res.status(201).json({ landing_page: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error creating landing page';
    console.error('[Admin LandingPages] Error creating landing page:', message);
    return res.status(400).json({ message });
  }
}
