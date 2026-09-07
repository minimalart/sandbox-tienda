import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';

import { buildResetLink, resolveStorefrontBase } from '../lib/reset-link';

type CustomerGraphResult = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
};

function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim();
}

/**
 * Envía el link de restablecimiento de contraseña por WhatsApp. Escucha
 * `auth.password_reset` (AuthWorkflowEvents.PASSWORD_RESET). El evento trae el EMAIL
 * (entity_id) y el token, pero no el teléfono: buscamos el cliente por email para
 * obtenerlo.
 *
 * La `metadata` del evento —que el core copia del body del reseteo y el storefront ya
 * puebla con `{ sales_channel_id, country_code, web_url }`— da la tienda de origen. Se
 * usa para las dos cosas que antes salían de una env var única: el link apunta al
 * dominio de ESA tienda (validado contra el allowlist, ver `lib/reset-link.ts`) y el
 * `sales_channel_id` viaja en la data para que el provider de WhatsApp resuelva el
 * número de ESA tienda en vez del global. Su gemelo por mail hace lo mismo.
 *
 * Solo aplica a clientes (actor_type='customer'); si no hay teléfono o no es
 * cliente, se omite. Cualquier fallo se loguea y nunca se propaga.
 */
export default async function handlePasswordResetWhatsapp({
  event,
  container,
}: SubscriberArgs<{
  entity_id?: string;
  token?: string;
  actor_type?: string;
  metadata?: Record<string, unknown>;
}>) {
  const { entity_id: email, token, actor_type, metadata } = event.data ?? {};

  // Reseteos de admin/usuario no van por WhatsApp.
  if (actor_type && actor_type !== 'customer') return;
  if (!email || !token) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<{
    graph: (input: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);
  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);

  let customer: CustomerGraphResult | undefined;
  try {
    const { data: customers } = (await query.graph({
      entity: 'customer',
      fields: ['id', 'email', 'first_name', 'last_name', 'phone'],
      filters: { email },
    })) as { data: CustomerGraphResult[] };
    customer = customers[0];
  } catch (error) {
    logger.warn(
      `[Password Reset WhatsApp] No se pudo buscar el cliente ${email}: ${(error as Error).message}`,
    );
    return;
  }

  const phone = customer?.phone ?? undefined;
  if (!phone) {
    logger.info(
      `[Password Reset WhatsApp] Cliente ${email} sin teléfono — se omite WhatsApp (el email sigue su curso).`,
    );
    return;
  }

  const salesChannelId = metadata?.sales_channel_id;
  const resetUrl = buildResetLink(
    resolveStorefrontBase(metadata?.web_url, (message) =>
      logger.warn(`[Password Reset WhatsApp] ${message}`),
    ),
    token,
    email,
  );

  try {
    await notificationService.createNotifications({
      to: phone,
      channel: 'whatsapp',
      template: 'password-reset',
      data: {
        customer_name: fullName(customer?.first_name, customer?.last_name) || undefined,
        reset_url: resetUrl,
        customer_email: email,
        ...(typeof salesChannelId === 'string' && salesChannelId
          ? { sales_channel_id: salesChannelId }
          : {}),
      },
    });
  } catch (error) {
    logger.warn(
      `[Password Reset WhatsApp] password-reset no enviado a ${phone} (${email}): ${(error as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'auth.password_reset',
};
