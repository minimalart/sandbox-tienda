import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type {
  ICustomerModuleService,
  INotificationModuleService,
  Logger,
} from '@medusajs/framework/types';
import { CORPORATE_MODULE } from '../modules/corporate';
import type CorporateModuleService from '../modules/corporate/service';

/**
 * Resuelve el email del dueño (owner) de una empresa corporativa.
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
 * Envía el correo `b2b-client-approved` al owner cuando una empresa corporativa
 * pasa a estado activo (`corporate.activated`). El payload trae sólo `{ id }`.
 * Cualquier fallo de envío se loguea como warning y nunca se propaga al event bus.
 */
export default async function handleCorporateActivatedEmail({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const corporateId = event.data.id;
  if (!corporateId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
  const corporateService = container.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER);

  let corporate: { name?: string };
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
  if (!ownerEmail) {
    logger.warn(
      `[Corporate Email] Empresa ${corporateId} sin email de owner — se omite b2b-client-approved.`,
    );
    return;
  }

  try {
    await notificationService.createNotifications({
      to: ownerEmail,
      channel: 'email',
      template: 'b2b-client-approved',
      data: {
        site_id: (corporate as { site_id?: string | null }).site_id ?? undefined,
        name: corporate.name ?? undefined,
        company_name: corporate.name ?? undefined,
        email: ownerEmail,
      },
    });
  } catch (error) {
    logger.warn(
      `[Corporate Email] b2b-client-approved no enviado a ${ownerEmail} (empresa ${corporateId}): ${(error as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'corporate.activated',
};
