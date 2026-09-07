import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';

import { buildResetLink, resolveStorefrontBase } from '../lib/reset-link';

/**
 * Envía el link de restablecimiento de contraseña por email. Escucha
 * `auth.password_reset` (AuthWorkflowEvents.PASSWORD_RESET).
 *
 * `entity_id` ES el email del cliente, así que no hace falta consultar la DB (a
 * diferencia del canal WhatsApp, que necesita el teléfono). El branding (logo,
 * colores, nombre) lo inyecta el provider de email desde `email_branding`.
 *
 * ── LA `metadata` DEL EVENTO EXISTE, Y SE ESTABA TIRANDO ──────────────────────────
 *
 * Este subscriber destructuraba `{ entity_id, token, actor_type }` y nada más, y
 * `lib/multistore/job-scope.ts` daba el caso por perdido: "el core lo emite con tres
 * campos, `entity_id` es el email y no hay de dónde agarrarse". Es falso. El payload
 * lo arma `generateResetPasswordTokenWorkflow` y su cuarto campo es
 * `metadata: input.metadata ?? {}`, que la ruta del core
 * (`auth/[actor_type]/[auth_provider]/reset-password`) copia tal cual del body.
 *
 * Y el storefront YA lo manda: `app/api/store/auth/route.ts` pasa
 * `{ sales_channel_id, country_code, web_url }` en cada pedido de reseteo. Los dos
 * agujeros que el comentario viejo daba por estructurales —la tienda y la URL— venían
 * en la mano desde el otro lado del request; sólo faltaba abrirla.
 *
 * Con `sales_channel_id` el provider resuelve la tienda por
 * `siteIdForNotification` → `resolveSiteViaSql`, y con eso la plantilla publicada de
 * ESA tienda y su branding se aplican también en una instalación MULTITIENDA — antes
 * sólo funcionaba por `implicitSiteId`, o sea únicamente con una sola tienda.
 *
 * Solo aplica a clientes (actor_type='customer' o ausente); los reseteos de
 * admin/usuario usan otro flujo/link y se omiten. Best-effort: cualquier fallo se
 * loguea y nunca se propaga al event bus.
 */
export default async function handlePasswordResetEmail({
  event,
  container,
}: SubscriberArgs<{
  entity_id?: string;
  token?: string;
  actor_type?: string;
  metadata?: Record<string, unknown>;
}>) {
  const { entity_id: email, token, actor_type, metadata } = event.data ?? {};

  // Reseteos de admin/usuario no usan el template ni el link del storefront.
  if (actor_type && actor_type !== 'customer') return;
  if (!email || !token) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);

  const salesChannelId = metadata?.sales_channel_id;
  const baseUrl = resolveStorefrontBase(metadata?.web_url, (message) =>
    logger.warn(`[Password Reset Email] ${message}`),
  );

  const resetUrl = buildResetLink(baseUrl, token, email);

  try {
    await notificationService.createNotifications({
      to: email,
      channel: 'email',
      template: 'password-reset',
      data: {
        link_reseteo: resetUrl,
        customer_email: email,
        // El eje de tienda del mail. Es una de las dos formas que
        // `email/service.ts siteIdForNotification` acepta; sin esto el provider queda
        // a merced de `implicitSiteId`, que con más de una tienda devuelve `null` a
        // propósito y manda el mail con la marca y la plantilla globales.
        ...(typeof salesChannelId === 'string' && salesChannelId
          ? { sales_channel_id: salesChannelId }
          : {}),
      },
    });
  } catch (error) {
    logger.warn(
      `[Password Reset Email] password-reset no enviado a ${email}: ${(error as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'auth.password_reset',
};
