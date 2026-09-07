import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { updateEmailTemplateWorkflow } from '../../../../../workflows/update-email-template';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { EMAIL_TEMPLATE_SITE_SCOPE } from '../../../../../modules/email-template/site-scope';

/** POST /admin/email-templates/:id/publish — mark published (overrides code). */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Mismo guard que el detalle: publicar es la mutación que hace que la plantilla
  // le gane al código, así que con el id de una ajena se cambia qué mail sale de
  // otra tienda. Afuera del try para que el 404 del guard no baje a 400.
  await assertIdInSite(req.scope, await siteFromRequest(req), EMAIL_TEMPLATE_SITE_SCOPE, req.params.id as string);

  try {
    const userId = (req as { auth_context?: { actor_id?: string } })
      .auth_context?.actor_id;

    const { result } = await updateEmailTemplateWorkflow(req.scope).run({
      input: {
        id: req.params.id as string,
        status: 'published',
        updated_by: userId,
      },
    });

    return res.status(200).json({ email_template: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error publishing email template';
    console.error('[Admin EmailTemplates] Error publishing template:', message);
    return res.status(400).json({ message });
  }
}
