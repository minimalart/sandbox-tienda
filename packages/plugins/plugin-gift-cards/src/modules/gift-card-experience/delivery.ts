import type { INotificationModuleService, Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { decryptGiftCardToken } from './crypto';
import { GIFT_CARD_EXPERIENCE_MODULE } from '.';
import type GiftCardExperienceModuleService from './service';
import { getGiftCardExperienceSettings } from './settings';
import type { GiftCardDeliveryRow } from './types';

import { channelOfOrder } from './order-channel';

function storefrontOrigin(): string {
  const configured = process.env.STOREFRONT_URL;
  if (!configured) throw new Error('STOREFRONT_URL is required to deliver gift cards.');
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('STOREFRONT_URL must use HTTP or HTTPS.');
  return url.origin;
}

function landingUrl(delivery: GiftCardDeliveryRow): string {
  if (!delivery.token_encrypted) throw new Error('The delivery has no secure token.');
  const token = decryptGiftCardToken(delivery.token_encrypted);
  const countryCode = process.env.DEFAULT_COUNTRY_CODE?.toLowerCase() || 'ar';
  return `${storefrontOrigin()}/${countryCode}/gift-card/${encodeURIComponent(token)}`;
}

async function send(
  notifications: INotificationModuleService,
  delivery: GiftCardDeliveryRow,
  recipient: string,
  template: string,
  extra: Record<string, unknown> = {},
  salesChannelId: string | null = null,
): Promise<{ id?: string } | undefined> {
  const [notification] = await notifications.createNotifications([{
    to: recipient,
    channel: 'email',
    template,
    data: {
      // La tienda que vendió la gift card, para que el mail salga con SU marca. La
      // entrega no tiene canal propio: lo hereda de su orden.
      sales_channel_id: salesChannelId ?? undefined,
      landing_url: landingUrl(delivery),
      value: Number(delivery.face_value),
      currency_code: delivery.currency_code,
      recipient_name: delivery.recipient_name,
      sender_name: delivery.anonymous ? null : delivery.sender_name,
      anonymous: delivery.anonymous,
      message: delivery.message,
      design: delivery.design_snapshot,
      expires_at: delivery.expires_at,
      ...extra,
    },
  }]);
  return notification;
}

async function notifyBuyerOnce(
  service: GiftCardExperienceModuleService,
  notifications: INotificationModuleService,
  delivery: GiftCardDeliveryRow,
  /** Ya resuelto por el batch: no vale la pena consultarlo dos veces por entrega. */
  salesChannelId: string | null = null,
): Promise<void> {
  if (delivery.fallback_sent_at || !delivery.buyer_email) return;
  const attempt = await service.startAttempt(delivery, 'fallback_buyer', delivery.buyer_email);
  await send(
    notifications,
    delivery,
    delivery.buyer_email,
    'gift-card-delivery-failed-buyer',
    { failed_recipient: delivery.recipient_email },
    salesChannelId,
  );
  await service.updateGiftCardDeliveryAttempts({ id: attempt.id, status: 'sent', completed_at: new Date() });
  await service.markFallbackSent(delivery.id);
}

export async function processGiftCardDeliveryBatch(container: MedusaContainer, limit = 20): Promise<number> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  /**
   * `null` EXPLÍCITO: acá el gate es de LOTE y todavía no puede dejar de serlo.
   *
   * La tentación obvia —resolver la tienda de cada entrega y leer SU `enabled`— rompe
   * el outbox: `claimDueDeliveries` RECLAMA las filas antes de que se sepa de qué
   * tienda son, así que gatear después dejaría las entregas de una tienda apagada
   * reclamadas y sin procesar para siempre. Cerrarlo pide que el reclamo filtre por
   * tienda (la entrega llega a la suya por `order_id` → `order.sales_channel_id`,
   * o sea un JOIN dentro del `UPDATE ... RETURNING`), o un barrido por tienda.
   * Está declarado en `job-scope.ts` como `pending`, con eso escrito.
   *
   * Lo que sí viaja bien es la marca: `channelOfOrder` resuelve el canal por entrega
   * y va en la `data` de la notificación.
   */
  const settings = await service.getSettings(null);
  if (!getGiftCardExperienceSettings().experienceEnabled || !settings.enabled) return 0;
  const notifications = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
  const deliveries = await service.claimDueDeliveries(limit);
  for (const delivery of deliveries) {
    const recipient = delivery.delivery_mode === 'recipient'
      ? delivery.recipient_email
      : delivery.buyer_email;
    if (!recipient) {
      const attempt = await service.startAttempt(delivery, delivery.attempts ? 'automatic_retry' : 'initial', delivery.buyer_email);
      await service.markDeliveryFailed(delivery, attempt.id, new Error('Recipient email is missing.'), settings.retry_delays_minutes);
      continue;
    }
    const manualResend = delivery.metadata?.manual_resend === true;
    const trigger = manualResend ? 'manual_resend' : delivery.attempts ? 'automatic_retry' : 'initial';
    const attempt = await service.startAttempt(delivery, trigger, recipient);
    if (manualResend) {
      await service.updateGiftCardDeliveries({
        id: delivery.id,
        metadata: { ...(delivery.metadata ?? {}), manual_resend: false },
      });
    }
    // Una sola consulta por entrega: la usan el envío Y el fallback al comprador.
    const salesChannelId = await channelOfOrder(container, delivery.order_id);

    try {
      const notification = await send(
        notifications,
        delivery,
        recipient,
        manualResend ? 'gift-card-resend' : 'gift-card-delivery',
        {},
        salesChannelId,
      );
      const providerMessageId = (notification as { external_id?: string } | undefined)?.external_id;
      await service.markDeliverySent(delivery.id, attempt.id, {
        notificationId: notification?.id,
        providerMessageId: providerMessageId ?? null,
      });
    } catch (error) {
      const status = await service.markDeliveryFailed(delivery, attempt.id, error, settings.retry_delays_minutes);
      logger.warn(`[Gift Card] Delivery ${delivery.id} failed; status=${status}.`);
      if (status === 'dead_letter' && settings.fallback_to_buyer) {
        try {
          const current = await service.retrieveGiftCardDelivery(delivery.id);
          await notifyBuyerOnce(
            service,
            notifications,
            current as unknown as GiftCardDeliveryRow,
            salesChannelId,
          );
        } catch (fallbackError) {
          logger.error(`[Gift Card] Buyer fallback failed for delivery ${delivery.id}: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        }
      }
    }
  }
  return deliveries.length;
}
