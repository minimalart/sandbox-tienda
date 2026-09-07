import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { EMAIL_TEMPLATE_MODULE } from '../../../modules/email-template';
import type EmailTemplateModuleService from '../../../modules/email-template/service';
import type { CreateEmailTemplateInput } from '../../../modules/email-template/types';
import { createEmailTemplateWorkflow } from '../../../workflows/create-email-template';
import { renderPuckEmailHtml } from '../../../modules/email-template/render-email';
import {
  PostAdminCreateEmailTemplate,
  type PostAdminCreateEmailTemplateInput,
} from './validators';

import { siteFromRequest } from '../../../lib/multistore/request';
import { assertWritableSiteId, siteDefaults, siteFilter } from '../../../lib/multistore/scope';
import { EMAIL_TEMPLATE_SITE_SCOPE } from '../../../modules/email-template/site-scope';

/**
 * GET /admin/email-templates — paginated list (limit, offset, status, q).
 * `q` matches name/key case-insensitively. Returns
 * { email_templates, count, limit, offset }, newest update first.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: EmailTemplateModuleService = req.scope.resolve(
      EMAIL_TEMPLATE_MODULE,
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
        { name: { $ilike: `%${q}%` } },
        { key: { $ilike: `%${q}%` } },
      ];
    }

    const resolution = await siteFromRequest(req);
    Object.assign(filters, await siteFilter(req.scope, resolution, EMAIL_TEMPLATE_SITE_SCOPE));

    const [email_templates, count] = await service.listAndCountEmailTemplates(
      filters,
      { skip: offset, take: limit, order: { updated_at: 'DESC' } },
    );

    return res.status(200).json({ email_templates, count, limit, offset });
  } catch (error) {
    console.error('[Admin EmailTemplates] Error listing templates:', error);
    return res.status(500).json({ message: 'Error fetching email templates' });
  }
}

/**
 * POST /admin/email-templates — create a template (zod-validated, via workflow).
 * Key is generated from the name when omitted and de-duplicated.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  let validated: PostAdminCreateEmailTemplateInput;
  try {
    validated = PostAdminCreateEmailTemplate.parse(req.body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error creating email template';
    console.error('[Admin EmailTemplates] Invalid create payload:', message);
    return res.status(400).json({ message });
  }

  /**
   * El eje se arbitra AFUERA del try, igual que `assertIdInSite` en las otras rutas:
   * si cae adentro, el 403 de política baja a un 400 genérico y el operador lee
   * "error al crear" en vez de por qué no se le permite.
   *
   * `undefined` (el body no trajo el campo) devuelve `{}` y manda `siteDefaults`, que
   * es el comportamiento histórico. `null` es GLOBAL —el valor que el validator recién
   * ahora sabe expresar— y un id concreto tiene que pasar la política Y existir.
   */
  const resolution = await siteFromRequest(req);
  const siteIdPatch = await assertWritableSiteId(
    req.scope,
    resolution,
    EMAIL_TEMPLATE_SITE_SCOPE,
    validated.site_id,
  );

  try {
    const userId = (req as { auth_context?: { actor_id?: string } })
      .auth_context?.actor_id;

    // When a Puck `design` is supplied, derive the `html` cache from it so the
    // send path stays in sync (same rule as the update route).
    const derivedHtml =
      validated.design != null
        ? await renderPuckEmailHtml(validated.design)
        : undefined;

    // `site_id` sale del body validado y vuelve a entrar SÓLO por `siteIdPatch`: el
    // patch ya es el veredicto de la política, y spreadear `validated` encima lo
    // pisaría con el valor crudo.
    const { site_id: _rawSiteId, ...fields } = validated;

    const { result } = await createEmailTemplateWorkflow(req.scope).run({
      input: {
        // Los defaults primero: un `site_id` explícito y PERMITIDO en el body gana.
        ...siteDefaults(resolution, EMAIL_TEMPLATE_SITE_SCOPE),
        ...fields,
        ...siteIdPatch,
        ...(derivedHtml ? { html: derivedHtml } : {}),
        created_by: userId,
      } as unknown as CreateEmailTemplateInput,
    });

    return res.status(201).json({ email_template: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error creating email template';
    console.error('[Admin EmailTemplates] Error creating template:', message);
    return res.status(400).json({ message });
  }
}
