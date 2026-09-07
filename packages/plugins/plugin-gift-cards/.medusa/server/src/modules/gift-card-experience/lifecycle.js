"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processGiftCardLifecycle = processGiftCardLifecycle;
const utils_1 = require("@medusajs/framework/utils");
const _1 = require(".");
const crypto_1 = require("./crypto");
const settings_1 = require("./settings");
const order_channel_1 = require("./order-channel");
function storefrontOrigin() {
    const configured = process.env.STOREFRONT_URL;
    if (!configured)
        throw new Error('STOREFRONT_URL is required for gift card lifecycle emails.');
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('STOREFRONT_URL must use HTTP or HTTPS.');
    return url.origin;
}
function storefrontPath(path) {
    const countryCode = process.env.DEFAULT_COUNTRY_CODE?.toLowerCase() || 'ar';
    return `${storefrontOrigin()}/${countryCode}${path}`;
}
function storefrontDestination(value, fallbackPath) {
    if (!value)
        return storefrontPath(fallbackPath);
    if (/^\/(?!\/)/.test(value) && !value.includes('\\'))
        return storefrontPath(value);
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('Merchandising URL must use HTTP or HTTPS.');
    return url.toString();
}
async function sendExpiring(notifications, delivery, recipient, salesChannelId = null) {
    if (!delivery.token_encrypted)
        throw new Error('The delivery has no secure token.');
    const token = (0, crypto_1.decryptGiftCardToken)(delivery.token_encrypted);
    const daysRemaining = Math.max(1, Math.ceil((new Date(delivery.expires_at).getTime() - Date.now()) / 86_400_000));
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
async function sendBalanceReminder(notifications, delivery, recipient, remaining, merchandisingUrl, salesChannelId = null) {
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
async function processGiftCardLifecycle(container) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const service = container.resolve(_1.GIFT_CARD_EXPERIENCE_MODULE);
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
    if (!(0, settings_1.getGiftCardExperienceSettings)().experienceEnabled || !settings.enabled)
        return { expiring: 0, reminders: 0 };
    const notifications = container.resolve(utils_1.Modules.NOTIFICATION);
    let expiring = 0;
    let reminders = 0;
    if (settings.expiring_notice_days) {
        const candidates = await service.listExpiringNotificationCandidates(settings.expiring_notice_days);
        for (const delivery of candidates) {
            const recipient = delivery.delivery_mode === 'recipient' ? delivery.recipient_email : delivery.buyer_email;
            if (!recipient)
                continue;
            const eventId = await service.claimLifecycleNotification(delivery, 'expiring_notice');
            if (!eventId)
                continue;
            try {
                const notification = await sendExpiring(notifications, delivery, recipient, await (0, order_channel_1.channelOfOrder)(container, delivery.order_id));
                await service.completeLifecycleNotification(eventId, notification?.id);
                expiring += 1;
            }
            catch (error) {
                await service.releaseLifecycleNotification(eventId);
                logger.warn(`[Gift Card] Expiring notice failed for delivery ${delivery.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    if (settings.balance_reminder_days) {
        const candidates = await service.listBalanceReminderCandidates(settings.balance_reminder_days);
        for (const { delivery, remaining, customer_email: recipient } of candidates) {
            const eventId = await service.claimLifecycleNotification(delivery, 'balance_reminder');
            if (!eventId)
                continue;
            try {
                const notification = await sendBalanceReminder(notifications, delivery, recipient, remaining, settings.merchandising_url, await (0, order_channel_1.channelOfOrder)(container, delivery.order_id));
                await service.completeLifecycleNotification(eventId, notification?.id);
                reminders += 1;
            }
            catch (error) {
                await service.releaseLifecycleNotification(eventId);
                logger.warn(`[Gift Card] Balance reminder failed for delivery ${delivery.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    return { expiring, reminders };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlmZWN5Y2xlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvZ2lmdC1jYXJkLWV4cGVyaWVuY2UvbGlmZWN5Y2xlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBcUZBLDREQWtFQztBQXRKRCxxREFBK0U7QUFDL0Usd0JBQWdEO0FBQ2hELHFDQUFnRDtBQUVoRCx5Q0FBMkQ7QUFHM0QsbURBQWlEO0FBRWpELFNBQVMsZ0JBQWdCO0lBQ3ZCLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDO0lBQzlDLElBQUksQ0FBQyxVQUFVO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyw0REFBNEQsQ0FBQyxDQUFDO0lBQy9GLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2hDLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsd0NBQXdDLENBQUMsQ0FBQztJQUMzRyxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUM7QUFDcEIsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLElBQVk7SUFDbEMsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxXQUFXLEVBQUUsSUFBSSxJQUFJLENBQUM7SUFDNUUsT0FBTyxHQUFHLGdCQUFnQixFQUFFLElBQUksV0FBVyxHQUFHLElBQUksRUFBRSxDQUFDO0FBQ3ZELENBQUM7QUFFRCxTQUFTLHFCQUFxQixDQUFDLEtBQWdDLEVBQUUsWUFBb0I7SUFDbkYsSUFBSSxDQUFDLEtBQUs7UUFBRSxPQUFPLGNBQWMsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNoRCxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMs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