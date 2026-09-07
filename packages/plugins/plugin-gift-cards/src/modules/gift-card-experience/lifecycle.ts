import type { INotificationModuleService, Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { GIFT_CARD_EXPERIENCE_MODULE } from '.';
import { decryptGiftCardToken } from './crypto';
import type GiftCardExperienceModuleService from './service';
import { getGiftCardExperienceSettings } from './settings';
import type { GiftCardDeliveryRow } from './types';

import { channelOfOrder } from './order-channel';

function storefrontOrigin(): string {
  const configured = process.env.STOREFRONT_URL;
  if (!configured) throw new Error('STOREFRONT_URL is required for gift card lifecycle emails.');
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('STOREFRONT_URL must use HTTP or HTTPS.');
  return url.origin;
}

function storefrontPath(path: string): string {
  const countryCode = process.env.DEFAULT_COUNTRY_CODE?.toLowerCase() || 'ar';
  return `${storefrontOrigin()}/${countryCode}${path}`;
}

function storefrontDestination(value: string | null | undefined, fallbackPath: string): string {
  if (!value) return storefrontPath(fallbackPath);
  if (/^\/(?!\/)/.test(value) && !value.includes('\\')) return storefrontPath(value);
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Merchandising URL must use HTTP or HTTPS.');
  return url.toString();
}

async function sendExpiring(
  notifications: INotificationModuleService,
  delivery: GiftCardDeliveryRow,
  recipient: string,
  salesChannelId: string | null = null,
): Promise<{ id?: string } | undefined> {
  if (!delivery.token_encrypted) throw new Error('The delivery has no secure token.');
  const token = decryptGiftCardToken(delivery.token_encrypted);
  const daysRemaining = Math.max(1, Math.ceil((new Date(delivery.expires_at!).getTime() - Date.now()) / 86_400_000));
  const created = await notifications.createNotifications([{
    to: recipient,
    channel: 'email',
    template: 'gift-card-expiring',
    data: {
      // La tienda que vendió la gift card, para que el aviso salga con SU marca.
      sales_channel_id: salesChannelId ?? undefined,
      landing_url: storefrontPath(`/gift-card/${encodeURIComponent(token)}`),
      value: Number(delivery.face_value),
      currency_code: delivery.currency_code,
      recipient_name: delivery.recipient_name,
      sender_name: delivery.anonymous ? null : delivery.sender_name,
      expires_at: delivery.expires_at,
      days_remaining: daysRemaining,
      design: delivery.design_snapshot,
    },
  }]);
  return created[0];
}

async function sendBalanceReminder(
  notifications: INotificationModuleService,
  delivery: GiftCardDeliveryRow,
  recipient: string,
  remaining: number,
  merchandisingUrl?: string | null,
  salesChannelId: string | null = null,
): Promise<{ id?: string } | undefined> {
  const created = await notifications.createNotifications([{
    to: recipient,
    channel: 'email',
    template: 'gift-card-balance-reminder',
    data: {
      sales_channel_id: salesChannelId ?? undefined,
      wallet_url: storefrontPath('/account/gift-cards'),
      merchandising_url: storefrontDestination(merchandisingUrl, '/store'),
      balance: remaining,
      value: Number(delivery.face_value),
      currency_code: delivery.currency_code,
      design: delivery.design_snapshot,
    },
  }]);
  return created[0];
}

export async function processGiftCardLifecycle(container: MedusaContainer): Promise<{ expiring: number; reminders: number }> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  /**
   * `null` EXPLÍCITO, y acá el hueco es más profundo que en la entrega.
   *
   * No es sólo el gate: `expiring_notice_days` y `balance_reminder_days` son los
   * PARÁMETROS DE LA CONSULTA que arma los candidatos (`listExpiringNotificationCandidates`),
   * no un valor que se aplique fila por fila. Que cada tienda tenga su cadencia no se
   * resuelve pasando otro argumento — pide un barrido por tienda, y con él la decisión
   * de producto de si un cliente que compró en dos tiendas recibe dos recordatorios de
   * saldo o uno. Queda `pending` en `job-scope.ts` con eso escrito, en vez de media
   * migración que mande el aviso correcto a la mitad de las tarjetas.
   */
  const settings = await service.getSettings(null);
  if (!getGiftCardExperienceSettings().experienceEnabled || !settings.enabled) return { expiring: 0, reminders: 0 };
  const notifications = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
  let expiring = 0;
  let reminders = 0;

  if (settings.expiring_notice_days) {
    const candidates = await service.listExpiringNotificationCandidates(settings.expiring_notice_days);
    for (const delivery of candidates) {
      const recipient = delivery.delivery_mode === 'recipient' ? delivery.recipient_email : delivery.buyer_email;
      if (!recipient) continue;
      const eventId = await service.claimLifecycleNotification(delivery, 'expiring_notice');
      if (!eventId) continue;
      try {
        const notification = await sendExpiring(
          notifications,
          delivery,
          recipient,
          await channelOfOrder(container, delivery.order_id),
        );
        await service.completeLifecycleNotification(eventId, notification?.id);
        expiring += 1;
      } catch (error) {
        await service.releaseLifecycleNotification(eventId);
        logger.warn(`[Gift Card] Expiring notice failed for delivery ${delivery.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  if (settings.balance_reminder_days) {
    const candidates = await service.listBalanceReminderCandidates(settings.balance_reminder_days);
    for (const { delivery, remaining, customer_email: recipient } of candidates) {
      const eventId = await service.claimLifecycleNotification(delivery, 'balance_reminder');
      if (!eventId) continue;
      try {
        const notification = await sendBalanceReminder(
          notifications,
          delivery,
          recipient,
          remaining,
          settings.merchandising_url,
          await channelOfOrder(container, delivery.order_id),
        );
        await service.completeLifecycleNotification(eventId, notification?.id);
        reminders += 1;
      } catch (error) {
        await service.releaseLifecycleNotification(eventId);
        logger.warn(`[Gift Card] Balance reminder failed for delivery ${delivery.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return { expiring, reminders };
}
