import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { EMAIL_TEMPLATE_MODULE } from '../../../../modules/email-template';
import type EmailTemplateModuleService from '../../../../modules/email-template/service';
import type { UpdateEmailTemplateInput } from '../../../../modules/email-template/types';
import { updateEmailTemplateWorkflow } from '../../../../workflows/update-email-template';
import { renderPuckEmailHtml } from '../../../../modules/email-template/render-email';
import {
  PostAdminUpdateEmailTemplate,
  type PostAdminUpdateEmailTemplateInput,
} from '../validators';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertIdInSite, assertWritableSiteId } from '../../../../lib/multistore/scope';
import { EMAIL_TEMPLATE_SITE_SCOPE } from '../../../../modules/email-template/site-scope';

/**
 * El `site_id` que la fila tiene HOY, para que la política pueda comparar.
 *
 * Es una lectura extra y por eso corre SÓLO cuando el body trae `site_id`: el 99% de
 * los guardados son de texto y no pagan nada. Si la fila no existe, `undefined` — el
 * `assertIdInSite` de arriba ya la habría rechazado, así que acá sólo cubre la carrera
 * con un borrado concurrente sin convertirla en un 500.
 */
async function currentSiteIdOf(
  req: MedusaRequest,
  id: string,
): Promise<string | null | undefined> {
  const service: EmailTemplateModuleService = req.scope.resolve(EMAIL_TEMPLATE_MODULE);
  try {
    const row = (await service.retrieveEmailTemplate(id)) as { site_id?: string | null };
    return row.site_id ?? null;
  } catch {
    return undefined;
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // Todos los handlers: editar la plantilla global desde la pantalla de una tienda
  // cambia el texto de los mails de TODAS las que no tienen la suya.
  await assertIdInSite(req.scope, await siteFromRequest(req), EMAIL_TEMPLATE_SITE_SCOPE, req.params.id as string);

  const service: EmailTemplateModuleService = req.scope.resolve(
    EMAIL_TEMPLATE_MODULE,
  );
  try {
    const email_template = await service.retrieveEmailTemplate(
      req.params.id as string,
    );
    return res.status(200).json({ email_template });
  } catch {
    return res.status(404).json({ message: 'Email template not found' });
  }
}

/** POST /admin/email-templates/:id — update (partial). */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Todos los handlers: editar la plantilla global desde la pantalla de una tienda
  // cambia el texto de los mails de TODAS las que no tienen la suya.
  const resolution = await siteFromRequest(req);
  await assertIdInSite(req.scope, resolution, EMAIL_TEMPLATE_SITE_SCOPE, req.params.id as string);

  let validated: PostAdminUpdateEmailTemplateInput;
  try {
    validated = PostAdminUpdateEmailTemplate.parse(req.body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error updating email template';
    console.error('[Admin EmailTemplates] Invalid update payload:', message);
    return res.status(400).json({ message });
  }

  /**
   * MUDAR la fila entre tiendas es otra operación que editarle el texto, y por eso el
   * guard es otro. `assertIdInSite` ya dijo que esta fila se puede TOCAR desde la
   * tienda activa —la global inclusive, porque el descriptor es `empty: 'all'`—, pero
   * no dice nada sobre cambiarle el dueño, que es lo que decide a QUIÉNES les cambia
   * el mail. La política vive en `lib/multistore/site-write.ts`.
   *
   * El `retrieve` corre SÓLO cuando el body trae el campo: la política necesita el
   * valor actual para no rebotar un no-op (un formulario que manda el objeto completo
   * reenvía el `site_id` que ya tenía en cada guardado) y para distinguir "me adueño
   * de la global" de "renombro mi propia fila".
   */
  const siteIdPatch = await assertWritableSiteId(
    req.scope,
    resolution,
    EMAIL_TEMPLATE_SITE_SCOPE,
    validated.site_id,
    validated.site_id === undefined
      ? undefined
      : await currentSiteIdOf(req, req.params.id as string),
  );

  try {
    const userId = (req as { auth_context?: { actor_id?: string } })
      .auth_context?.actor_id;

    // The Puck document is the source of truth. Whenever `design` is updated we
    // derive the `html` cache from it (React Email), so the send path and the
    // raw-SQL provider lookup keep reading a ready-to-Handlebars HTML string.
    const derivedHtml =
      validated.design != null
        ? await renderPuckEmailHtml(validated.design)
        : undefined;

    // Igual que en el alta: el `site_id` crudo se saca y vuelve sólo por el patch, que
    // ES el veredicto. Spreadear `validated` encima lo pisaría con el valor sin filtrar.
    const { site_id: _rawSiteId, ...fields } = validated;

    const { result } = await updateEmailTemplateWorkflow(req.scope).run({
      input: {
        id: req.params.id as string,
        ...fields,
        ...siteIdPatch,
        ...(derivedHtml !== undefined ? { html: derivedHtml } : {}),
        updated_by: userId,
      } as unknown as UpdateEmailTemplateInput & { id: string },
    });

    return res.status(200).json({ email_template: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error updating email template';
    console.error('[Admin EmailTemplates] Error updating template:', message);
    return res.status(400).json({ message });
  }
}

/** DELETE /admin/email-templates/:id — soft-delete. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  // Todos los handlers: editar la plantilla global desde la pantalla de una tienda
  // cambia el texto de los mails de TODAS las que no tienen la suya.
  await assertIdInSite(req.scope, await siteFromRequest(req), EMAIL_TEMPLATE_SITE_SCOPE, req.params.id as string);

  const service: EmailTemplateModuleService = req.scope.resolve(
    EMAIL_TEMPLATE_MODULE,
  );
  try {
    await (service as any).softDeleteEmailTemplates(req.params.id as string);
    return res.status(200).json({
      id: req.params.id as string,
      object: 'email_template',
      deleted: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error deleting email template';
    console.error('[Admin EmailTemplates] Error deleting template:', message);
    return res.status(400).json({ message });
  }
}
