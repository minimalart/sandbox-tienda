"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processGiftCardDeliveryBatch = processGiftCardDeliveryBatch;
const utils_1 = require("@medusajs/framework/utils");
const crypto_1 = require("./crypto");
const _1 = require(".");
const settings_1 = require("./settings");
const order_channel_1 = require("./order-channel");
function storefrontOrigin() {
    const configured = process.env.STOREFRONT_URL;
    if (!configured)
        throw new Error('STOREFRONT_URL is required to deliver gift cards.');
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('STOREFRONT_URL must use HTTP or HTTPS.');
    return url.origin;
}
function landingUrl(delivery) {
    if (!delivery.token_encrypted)
        throw new Error('The delivery has no secure token.');
    const token = (0, crypto_1.decryptGiftCardToken)(delivery.token_encrypted);
    const countryCode = process.env.DEFAULT_COUNTRY_CODE?.toLowerCase() || 'ar';
    return `${storefrontOrigin()}/${countryCode}/gift-card/${encodeURIComponent(token)}`;
}
async function send(notifications, delivery, recipient, template, extra = {}, salesChannelId = null) {
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
async function notifyBuyerOnce(service, notifications, delivery, 
/** Ya resuelto por el batch: no vale la pena consultarlo dos veces por entrega. */
salesChannelId = null) {
    if (delivery.fallback_sent_at || !delivery.buyer_email)
        return;
    const attempt = await service.startAttempt(delivery, 'fallback_buyer', delivery.buyer_email);
    await send(notifications, delivery, delivery.buyer_email, 'gift-card-delivery-failed-buyer', { failed_recipient: delivery.recipient_email }, salesChannelId);
    await service.updateGiftCardDeliveryAttempts({ id: attempt.id, status: 'sent', completed_at: new Date() });
    await service.markFallbackSent(delivery.id);
}
async function processGiftCardDeliveryBatch(container, limit = 20) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const service = container.resolve(_1.GIFT_CARD_EXPERIENCE_MODULE);
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
    if (!(0, settings_1.getGiftCardExperienceSettings)().experienceEnabled || !settings.enabled)
        return 0;
    const notifications = container.resolve(utils_1.Modules.NOTIFICATION);
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
        const salesChannelId = await (0, order_channel_1.channelOfOrder)(container, delivery.order_id);
        try {
            const notification = await send(notifications, delivery, recipient, manualResend ? 'gift-card-resend' : 'gift-card-delivery', {}, salesChannelId);
            const providerMessageId = notification?.external_id;
            await service.markDeliverySent(delivery.id, attempt.id, {
                notificationId: notification?.id,
                providerMessageId: providerMessageId ?? null,
            });
        }
        catch (error) {
            const status = await service.markDeliveryFailed(delivery, attempt.id, error, settings.retry_delays_minutes);
            logger.warn(`[Gift Card] Delivery ${delivery.id} failed; status=${status}.`);
            if (status === 'dead_letter' && settings.fallback_to_buyer) {
                try {
                    const current = await service.retrieveGiftCardDelivery(delivery.id);
                    await notifyBuyerOnce(service, notifications, current, salesChannelId);
                }
                catch (fallbackError) {
                    logger.error(`[Gift Card] Buyer fallback failed for delivery ${delivery.id}: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
                }
            }
        }
    }
    return deliveries.length;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVsaXZlcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9naWZ0LWNhcmQtZXhwZXJpZW5jZS9kZWxpdmVyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQTZFQSxvRUEyRUM7QUF2SkQscURBQStFO0FBQy9FLHFDQUFnRDtBQUNoRCx3QkFBZ0Q7QUFFaEQseUNBQTJEO0FBRzNELG1EQUFpRDtBQUVqRCxTQUFTLGdCQUFnQjtJQUN2QixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQztJQUM5QyxJQUFJLENBQUMsVUFBVTtRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsbURBQW1ELENBQUMsQ0FBQztJQUN0RixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNoQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLHdDQUF3QyxDQUFDLENBQUM7SUFDM0csT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDO0FBQ3BCLENBQUM7QUFFRCxTQUFTLFVBQVUsQ0FBQyxRQUE2QjtJQUMvQyxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWU7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7SUFDcEYsTUFBTSxLQUFLLEdBQUcsSUFBQSw2QkFBb0IsRUFBQyxRQUFRLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDN0QsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxXQUFXLEVBQUUsSUFBSSxJQUFJLENBQUM7SUFDNUUsT0FBTyxHQUFHLGdCQUFnQixFQUFFLElBQUksV0FBVyxjQUFjLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7QUFDdkYsQ0FBQztBQUVE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