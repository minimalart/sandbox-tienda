import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import type { INotificationModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import { EMAIL_TEMPLATE_MODULE } from '../../../../../modules/email-template';
import type EmailTemplateModuleService from '../../../../../modules/email-template/service';
import { renderEmailTemplate } from '../../../../../modules/email-template/render';
import { PostAdminTestSendEmailTemplate } from '../../validators';
import { withBrandingDefaults } from '../../../../../modules/email-template/branding-defaults';
import { withCatalogSampleData } from '../../../../../modules/email-template/catalog-sample-data';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { EMAIL_TEMPLATE_SITE_SCOPE } from '../../../../../modules/email-template/site-scope';

/**
 * POST /admin/email-templates/:id/test-send — render the stored template with
 * `data` (falling back to `sample_data`) and send it to `to` via the email
 * channel. Uses the provider's reserved `__inline__` template so the rendered
 * subject/html go out as-is regardless of the template's draft/published state.
 *
 * EL BRANDING SE INYECTA ACÁ, ANTES DE RENDERIZAR, Y NO PUEDE SER DE OTRA MANERA.
 * `__inline__` es justamente el camino que le pide al provider que NO toque el
 * contenido: `resolveContent` devuelve `__subject`/`__html` tal cual vinieron. O sea
 * que el `fillEmpty` del provider —el que pone logo, colores y nombre de la tienda—
 * corre sobre una `data` que ya no alimenta a nadie. Mandar `site_id` en la
 * notificación no alcanzaba, y era lo que se hacía.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: EmailTemplateModuleService = req.scope.resolve(
      EMAIL_TEMPLATE_MODULE,
    );
    const notificationService: INotificationModuleService = req.scope.resolve(
      Modules.NOTIFICATION,
    );

    const { to, data } = PostAdminTestSendEmailTemplate.parse(req.body);
    // Probar la plantilla de otra tienda no rompe nada, pero manda un mail a una
    // dirección real con contenido que el operador no debería estar viendo.
    const resolution = await siteFromRequest(req);
    await assertIdInSite(req.scope, resolution, EMAIL_TEMPLATE_SITE_SCOPE, req.params.id as string);

    const stored = await service.retrieveEmailTemplate(req.params.id as string);

    /**
     * Mismo criterio que `preview`: los productos de `data` que sigan iguales a
     * los de `sample_data` (del seed, iguales en toda instalación) se cambian
     * por productos reales de la tienda activa. Ver `../../catalog-sample-data.ts`.
     */
    const sampleData = await withCatalogSampleData(
      req,
      resolution,
      data,
      stored.sample_data as Record<string, unknown> | null,
    );

    const rendered = renderEmailTemplate({
      subject: stored.subject as string,
      html: stored.html as string,
      data: await withBrandingDefaults(req, resolution, { ...(sampleData ?? {}) }),
    });

    await notificationService.createNotifications({
      to,
      channel: 'email',
      template: '__inline__',
      data: {
        // El eje de tienda del envío. NO es lo que le pone el branding al contenido
        // —eso ya pasó arriba, ver el encabezado— pero sí decide de qué tienda se
        // resuelve el remitente y con qué clave cachea el provider.
        site_id: resolution.status === 'site' ? resolution.site.id : undefined,
        __subject: rendered.subject,
        __html: rendered.html,
      },
    });

    return res.status(200).json({ sent: true, to });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error sending test email';
    console.error('[Admin EmailTemplates] Error sending test email:', message);
    return res.status(400).json({ message });
  }
}
