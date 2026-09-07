import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';
import { z } from 'zod';
import { CONTACT_MODULE } from '../../../modules/contact';
import type ContactModuleService from '../../../modules/contact/service';
import { resolveSite } from '../../../lib/multistore-shim';
import { resolveAdminNotificationEmail } from '../../../lib/admin-email-shim';

const BodySchema = z.object({
  first_name: z.string().trim().min(1).max(120),
  last_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  message: z.string().trim().min(1).max(5000),
  source: z.string().trim().max(60).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * POST /store/contact-submissions — persiste un envío del formulario de
 * contacto para que quede registrado en el backoffice. Requiere publishable
 * key (middleware de store de Medusa).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
  }
  const body = parsed.data;
  const service: ContactModuleService = req.scope.resolve(CONTACT_MODULE);

  const meta = (body.metadata ?? {}) as Record<string, unknown>;
  const fwd = req.headers['x-forwarded-for'];
  const ip =
    (typeof meta.ip === 'string' && meta.ip) ||
    (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;
  const user_agent =
    (typeof meta.user_agent === 'string' && meta.user_agent) ||
    (req.headers['user-agent'] as string) ||
    null;

  /**
   * La tienda sale de la publishable key, que es lo ÚNICO confiable acá: el
   * header `x-site-id` es del admin y un storefront no lo manda. Si la key no
   * trae canal o el canal no es de ninguna tienda, queda `null` — un mensaje
   * sin tienda se sigue viendo en el backoffice, que es preferible a
   * rechazarlo y perder la consulta.
   */
  const channelIds = (req as unknown as {
    publishable_key_context?: { sales_channel_ids?: string[] };
  }).publishable_key_context?.sales_channel_ids;
  const resolution = await resolveSite(req.scope, {
    salesChannelId: channelIds?.[0] ?? null,
  });
  const site_id = resolution.status === 'site' ? resolution.site.id : null;

  /**
   * La tienda para los CORREOS, que no es la misma decisión que la columna.
   *
   * Para `submission.site_id` sólo vale `site`: es un dato persistido que el
   * backoffice filtra, y sellar la única tienda en una instalación mono-tienda
   * escribiría un eje que hoy nadie eligió.
   *
   * Para los mails, en cambio, `singleSite` SÍ cuenta, y es el mismo criterio de
   * `email/service.ts:implicitSiteId` y de `email/admin-recipient.ts`: con UNA
   * sola fila en el registro, "de qué tienda es este correo" no tiene otra
   * respuesta posible. Y del lado de la lectura es precedencia, no filtrado, así
   * que sólo agrega un candidato: sin branding ni plantilla por tienda se sigue
   * leyendo la fila global de siempre.
   *
   * `allSites` (varias tiendas y una key que no matchea ninguna) queda en `null`
   * a propósito: elegir una mandaría el aviso de la tienda B al buzón de la A.
   */
  const email_site_id =
    resolution.status === 'site' || resolution.status === 'singleSite'
      ? resolution.site.id
      : null;

  const [submission] = await service.createContactSubmissions([
    {
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone ?? null,
      message: body.message,
      status: 'new',
      source: body.source ?? 'storefront',
      ip,
      user_agent,
      site_id,
    },
  ]);

  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  // Evento para tracking (el módulo ga4 lo mapea a GA4 generate_lead). Se pasa
  // el ga_client_id del navegador (si el storefront lo envió en metadata) para
  // la atribución server-side. Best-effort: un fallo NO rompe la respuesta.
  const gaClientId =
    typeof meta.ga_client_id === 'string' && meta.ga_client_id ? meta.ga_client_id : undefined;
  try {
    const eventBus = req.scope.resolve(Modules.EVENT_BUS);
    await eventBus.emit({
      name: 'contact.submission_created',
      data: { id: (submission as { id: string }).id, ga_client_id: gaClientId },
    });
  } catch (error) {
    logger.warn(
      `[Contact] No se pudo emitir contact.submission_created: ${(error as Error).message}`,
    );
  }

  // La submission ya está persistida: los correos son best-effort. Un fallo de
  // envío NO debe romper la respuesta HTTP (el registro quedó guardado).
  try {
    const notificationService = req.scope.resolve<INotificationModuleService>(
      Modules.NOTIFICATION,
    );
    /**
     * `site_id` viaja en la DATA de las dos notificaciones, no sólo en la
     * elección del destinatario.
     *
     * Es la forma más explícita de las tres que acepta
     * `email/service.ts:siteIdForNotification`, y sin ella el provider caía a
     * `implicitSiteId()`: acertaba de casualidad en una instalación de una sola
     * tienda y, con varias, el acuse al remitente salía con el logo, los colores
     * y el remitente de otra tienda. El mail ya salió: no se puede deshacer.
     */
    const sharedData = {
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone ?? undefined,
      message: body.message,
      site_id: email_site_id ?? undefined,
    };

    // 1) Acuse al remitente.
    try {
      await notificationService.createNotifications({
        to: body.email,
        channel: 'email',
        template: 'contact-received',
        data: sharedData,
      });
    } catch (error) {
      logger.warn(
        `[Contact Email] contact-received no enviado a ${body.email}: ${(error as Error).message}`,
      );
    }

    // 2) Notificación al admin, a la casilla DE ESA TIENDA. Sin el segundo
    // argumento se leía siempre la fila global de `email_branding`, y el aviso de
    // contacto caía en un buzón distinto del de `order-notification-admin` dentro
    // de la misma tienda (medido en desdeelsur, 2026-09-03).
    const adminEmail = await resolveAdminNotificationEmail(req.scope, email_site_id);
    if (adminEmail) {
      try {
        await notificationService.createNotifications({
          to: adminEmail,
          channel: 'email',
          template: 'contact-notification-admin',
          data: sharedData,
        });
      } catch (error) {
        logger.warn(
          `[Contact Email] contact-notification-admin no enviado a ${adminEmail}: ${(error as Error).message}`,
        );
      }
    }
  } catch (error) {
    logger.warn(
      `[Contact Email] No se pudieron enviar los correos de contacto: ${(error as Error).message}`,
    );
  }

  return res.status(201).json({ contact_submission: { id: (submission as { id: string }).id } });
}
