import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type {
  ICustomerModuleService,
  INotificationModuleService,
  Logger,
} from '@medusajs/framework/types';
import { COMPANY_MODULE } from '../modules/company';
import type CompanyModuleService from '../modules/company/service';
import { getAdminNotificationEmail } from '../modules/email/admin-recipient';

/**
 * Resuelve el email del dueño (owner) de una empresa: busca su membership
 * activa con rol owner y obtiene el email del customer asociado.
 */
async function resolveOwnerEmail(
  companyService: CompanyModuleService,
  customerService: ICustomerModuleService,
  companyId: string,
): Promise<string | null> {
  const members = await companyService.getActiveMembers(companyId);
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
 * Envía los correos de "registro de empresa" al crearse una company:
 *  - `company-register` al email del owner.
 *  - `company-register-admin` al destinatario admin configurado.
 *
 * El payload de `company.created` trae sólo `{ id }`, así que la empresa y el
 * email del owner se resuelven vía los módulos Company/Customer. Cualquier fallo
 * de envío se loguea como warning y nunca se propaga al event bus.
 */
export default async function handleCompanyCreatedEmail({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const companyId = event.data.id;
  if (!companyId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
  const companyService = container.resolve<CompanyModuleService>(COMPANY_MODULE);
  const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER);

  let company: { name?: string; legal_name?: string | null; tax_id?: string | null };
  try {
    company = await companyService.retrieveCompany(companyId);
  } catch (error) {
    logger.warn(
      `[Company Email] No se pudo leer la empresa ${companyId}: ${(error as Error).message}`,
    );
    return;
  }
  if (!company) return;

  const ownerEmail = await resolveOwnerEmail(companyService, customerService, companyId);

  const sharedData = {
    // La tienda de la empresa: el mail de alta B2B tiene que llevar SU marca.
    sales_channel_id: (company as { sales_channel_id?: string | null }).sales_channel_id ?? undefined,
    nombre_empresa: company.name ?? undefined,
    legal_name: company.legal_name ?? undefined,
    tax_id: company.tax_id ?? undefined,
  };

  // 1) Acuse al owner.
  if (ownerEmail) {
    try {
      await notificationService.createNotifications({
        to: ownerEmail,
        channel: 'email',
        template: 'company-register',
        data: { ...sharedData, email: ownerEmail },
      });
    } catch (error) {
      logger.warn(
        `[Company Email] company-register no enviado a ${ownerEmail} (empresa ${companyId}): ${(error as Error).message}`,
      );
    }
  } else {
    logger.warn(`[Company Email] Empresa ${companyId} sin email de owner — se omite el acuse al usuario.`);
  }

  // 2) Notificación al admin.
  //
  // Con la MISMA tienda que el acuse al owner. Sin la pista, la copia interna salía
  // por la fila global de `email_branding`: el aviso de "empresa nueva" de la tienda
  // B caía en el buzón del operador de la principal, aunque la pantalla que lo
  // configura (`admin/store-config/email-branding`) guarde por tienda.
  //
  // Sigue siendo UN mail al owner y UNO al admin por empresa creada: cambia la
  // casilla del segundo, no la cantidad.
  const adminEmail = await getAdminNotificationEmail(container, {
    salesChannelId: sharedData.sales_channel_id,
  });
  if (adminEmail) {
    try {
      await notificationService.createNotifications({
        to: adminEmail,
        channel: 'email',
        template: 'company-register-admin',
        data: { ...sharedData, email: ownerEmail ?? undefined },
      });
    } catch (error) {
      logger.warn(
        `[Company Email] company-register-admin no enviado a ${adminEmail} (empresa ${companyId}): ${(error as Error).message}`,
      );
    }
  }
}

export const config: SubscriberConfig = {
  event: 'company.created',
};
