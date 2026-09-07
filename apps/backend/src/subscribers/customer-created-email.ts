import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type {
  ICustomerModuleService,
  INotificationModuleService,
  Logger,
} from '@medusajs/framework/types';

/**
 * Envía el correo de bienvenida `customer-register` cuando se crea un cliente.
 * El payload del evento `customer.created` trae únicamente `{ id }`, así que se
 * resuelve el customer vía el módulo de Customer para obtener email y nombre.
 * Un fallo de envío se loguea como warning y nunca se propaga al event bus.
 */
export default async function handleCustomerCreatedEmail({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const customerId = event.data.id;
  if (!customerId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
  const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER);

  let customer: { email?: string | null; first_name?: string | null; last_name?: string | null };
  try {
    customer = await customerService.retrieveCustomer(customerId);
  } catch (error) {
    logger.warn(
      `[Customer Email] No se pudo leer el cliente ${customerId}: ${(error as Error).message}`,
    );
    return;
  }

  if (!customer?.email) {
    logger.warn(`[Customer Email] Cliente ${customerId} sin email — se omite el envío.`);
    return;
  }

  const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();

  try {
    await notificationService.createNotifications({
      to: customer.email,
      channel: 'email',
      template: 'customer-register',
      data: {
        name: name || undefined,
        email: customer.email,
      },
    });
  } catch (error) {
    logger.warn(
      `[Customer Email] customer-register no enviado a ${customer.email} (cliente ${customerId}): ${(error as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'customer.created',
};
