import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { EMAIL_TEMPLATE_MODULE } from '../../../../../modules/email-template';
import type EmailTemplateModuleService from '../../../../../modules/email-template/service';
import { renderEmailTemplate } from '../../../../../modules/email-template/render';
import { renderPuckEmailHtml } from '../../../../../modules/email-template/render-email';
import { PostAdminPreviewEmailTemplate } from '../../validators';
import { withBrandingDefaults } from '../../../../../modules/email-template/branding-defaults';
import { withCatalogSampleData } from '../../../../../modules/email-template/catalog-sample-data';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { EMAIL_TEMPLATE_SITE_SCOPE } from '../../../../../modules/email-template/site-scope';

/**
 * POST /admin/email-templates/:id/preview — render the template server-side and
 * return { subject, html }. The editor passes its current (possibly unsaved)
 * Puck `design` so the preview reflects live block edits; it is rendered to HTML
 * (React Email) and then run through Handlebars with the sample `data`. Falls
 * back to a raw `html` override, then to the stored row. `data` falls back to
 * the row's `sample_data`.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Mismo guard que el detalle, aunque acá no se escriba nada: el handler lee la
  // fila almacenada y devuelve su asunto y su HTML renderizado, así que sin esto
  // el id de una plantilla ajena expone el contenido de los mails de otra tienda.
  // Va AFUERA del try a propósito: adentro, el catch convertiría el 404 del guard
  // en un 400 con el mensaje, y el status es parte de lo que no filtra existencia.
  //
  // La resolución se CAPTURA en vez de descartarse: el branding de la vista previa
  // se lee de ESTA tienda. Antes se llamaba `getEmailBranding()` sin argumento, o
  // sea el global, y el operador de la tienda B veía el logo de la instancia.
  const resolution = await siteFromRequest(req);
  await assertIdInSite(req.scope, resolution, EMAIL_TEMPLATE_SITE_SCOPE, req.params.id as string);

  try {
    const service: EmailTemplateModuleService = req.scope.resolve(
      EMAIL_TEMPLATE_MODULE,
    );
    const stored = await service.retrieveEmailTemplate(req.params.id as string);
    const body = PostAdminPreviewEmailTemplate.parse(req.body ?? {});

    // Treat empty strings as "not provided" so a not-yet-hydrated editor (or a
    // stale client) falls back to the stored content instead of rendering blank.
    const subject = body.subject?.length
      ? body.subject
      : (stored.subject as string);

    // Prefer the live Puck design (render → HTML), then a raw html override,
    // then the stored html cache.
    let html: string;
    if (body.design != null) {
      html = await renderPuckEmailHtml(body.design);
    } else if (body.html?.length) {
      html = body.html;
    } else {
      html = stored.html as string;
    }

    /**
     * `sample_data` es el mismo para TODAS las instalaciones (lo escribió una
     * sola vez `scripts/seed-email-templates.ts`, con productos de ejemplo del
     * boilerplate). Los productos que sigan iguales a los guardados se cambian
     * por productos reales de la tienda activa — también cuando llega `data`,
     * porque el editor del admin lo manda SIEMPRE con el `sample_data` cargado.
     * Ver `../../catalog-sample-data.ts`.
     */
    const sampleData = await withCatalogSampleData(
      req,
      resolution,
      body.data,
      stored.sample_data as Record<string, unknown> | null,
    );

    /**
     * El branding va como DEFAULTS para que la vista previa se parezca a lo que
     * recibe el cliente. Vive en `../../branding-defaults.ts` y no acá porque el
     * "Enviar prueba" necesita EXACTAMENTE lo mismo y no lo tenía: la misma
     * plantilla se veía bien en pantalla y llegaba sin estilos al buzón.
     */
    const data = await withBrandingDefaults(req, resolution, { ...(sampleData ?? {}) });

    const rendered = renderEmailTemplate({ subject, html, data });
    return res.status(200).json(rendered);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error rendering preview';
    console.error('[Admin EmailTemplates] Error rendering preview:', message);
    return res.status(400).json({ message });
  }
}
