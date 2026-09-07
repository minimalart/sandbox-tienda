import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type {
  ICustomerModuleService,
  INotificationModuleService,
  Logger,
} from '@medusajs/framework/types';
import { CORPORATE_MODULE } from '../modules/corporate';
import type CorporateModuleService from '../modules/corporate/service';
import { getAdminNotificationEmail } from '../modules/email/admin-recipient';

/**
 * Resuelve el email del dueño (owner) de una empresa corporativa: busca su
 * membership owner y obtiene el email del customer asociado.
 */
async function resolveOwnerEmail(
  corporateService: CorporateModuleService,
  customerService: ICustomerModuleService,
  corporateId: string,
): Promise<string | null> {
  const members = await corporateService.listCorporateMembers({
    corporate_id: corporateId,
  });
  const owner = members.find((m) => m.role === 'owner') ?? members[0];
  if (!owner?.customer_id) return null;
  try {
    const customer = await customerService.retrieveCustomer(owner.customer_id);
    return customer?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Envía los correos de "solicitud de registro corporativo" al crearse una
 * corporate:
 *  - `corporate-register` (acuse) al email del owner solicitante.
 *  - `corporate-register-admin` al destinatario admin configurado.
 *
 * El payload de `corporate.created` trae sólo `{ id }`. Cualquier fallo de envío
 * se loguea como warning y nunca se propaga al event bus.
 */
export default async function handleCorporateCreatedEmail({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const corporateId = event.data.id;
  if (!corporateId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
  const corporateService = container.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER);

  let corporate: {
    name?: string;
    legal_name?: string | null;
    tax_id?: string | null;
    email_domain?: string | null;
  };
  try {
    corporate = await corporateService.retrieveCorporate(corporateId);
  } catch (error) {
    logger.warn(
      `[Corporate Email] No se pudo leer la empresa ${corporateId}: ${(error as Error).message}`,
    );
    return;
  }
  if (!corporate) return;

  const ownerEmail = await resolveOwnerEmail(corporateService, customerService, corporateId);

  const sharedData = {
    // La tienda de la empresa. `corporate` lleva `site_id` propio, no canal.
    site_id: (corporate as { site_id?: string | null }).site_id ?? undefined,
    nombre_empresa: corporate.name ?? undefined,
    legal_name: corporate.legal_name ?? undefined,
    tax_id: corporate.tax_id ?? undefined,
    email_domain: corporate.email_domain ?? undefined,
  };

  // 1) Acuse al owner solicitante.
  if (ownerEmail) {
    try {
      await notificationService.createNotifications({
        to: ownerEmail,
        channel: 'email',
        template: 'corporate-register',
        data: { ...sharedData, email: ownerEmail },
      });
    } catch (error) {
      logger.warn(
        `[Corporate Email] corporate-register no enviado a ${ownerEmail} (empresa ${corporateId}): ${(error as Error).message}`,
      );
    }
  } else {
    logger.warn(
      `[Corporate Email] Empresa ${corporateId} sin email de owner — se omite el acuse al usuario.`,
    );
  }

  // 2) Notificación al admin.
  //
  // Acá el eje es EXACTO y no hay traducción con pérdida: `corporate` lleva
  // `site_id` propio, así que la copia interna se resuelve por id de tienda y no
  // por canal. Es el único de los tres emisores de `getAdminNotificationEmail` que
  // no depende de `SiteRef.channel_ids`.
  //
  // La cantidad de mails no cambia —uno al solicitante y uno al admin por
  // solicitud—; cambia a qué buzón llega el segundo.
  const adminEmail = await getAdminNotificationEmail(container, {
    siteId: sharedData.site_id,
  });
  if (adminEmail) {
    try {
      await notificationService.createNotifications({
        to: adminEmail,
        channel: 'email',
        template: 'corporate-register-admin',
        data: { ...sharedData, email: ownerEmail ?? undefined },
      });
    } catch (error) {
      logger.warn(
        `[Corporate Email] corporate-register-admin no enviado a ${adminEmail} (empresa ${corporateId}): ${(error as Error).message}`,
      );
    }
  }
}

export const config: SubscriberConfig = {
  event: 'corporate.created',
};
