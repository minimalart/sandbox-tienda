"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGiftCardExperienceEnabled = isGiftCardExperienceEnabled;
exports.capturedAmount = capturedAmount;
exports.isFullyPaidOrder = isFullyPaidOrder;
exports.isUniqueConstraintError = isUniqueConstraintError;
exports.createGiftCardIntentsForOrder = createGiftCardIntentsForOrder;
exports.resolveBackingAccount = resolveBackingAccount;
exports.processGiftCardsForOrder = processGiftCardsForOrder;
const utils_1 = require("@medusajs/framework/utils");
const workflows_1 = require("@medusajs/loyalty-plugin/workflows");
const gift_cards_shared_1 = require("../../lib/gift-cards-shared");
const resolve_site_1 = require("../../lib/multistore/resolve-site");
const _1 = require(".");
const schedule_1 = require("./schedule");
const settings_1 = require("./settings");
/**
 * AND entre el interruptor de DESPLIEGUE (`app-settings`, DB > env) y el de
 * NEGOCIO (`gift_card_settings.enabled`). Hacen falta los dos.
 */
function isGiftCardExperienceEnabled(settingsEnabled) {
    return (0, settings_1.getGiftCardExperienceSettings)().experienceEnabled && settingsEnabled;
}
async function retrieveOrder(container, orderId) {
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
        entity: 'order',
        fields: [
            'id', 'display_id', 'email', 'customer_id', 'currency_code', 'total', 'status', 'canceled_at',
            'sales_channel_id',
            'items.id', 'items.quantity', 'items.unit_price', 'items.total', 'items.metadata',
            'items.product.is_giftcard',
            'payment_collections.payments.amount', 'payment_collections.payments.captured_at',
            'payment_collections.payments.canceled_at',
        ],
        filters: { id: orderId },
    });
    return data[0] ?? null;
}
function capturedAmount(order) {
    return (order.payment_collections ?? []).flatMap((collection) => collection.payments ?? [])
        .filter((payment) => Boolean(payment.captured_at) && !payment.canceled_at)
        .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
}
function isFullyPaidOrder(order) {
    if (order.canceled_at || order.status === 'canceled')
        return false;
    return capturedAmount(order) >= Number(order.total ?? 0);
}
function isUniqueConstraintError(error) {
    const value = error;
    const code = String(value?.code ?? value?.cause?.code ?? '');
    const message = String(value?.message ?? value?.cause?.message ?? '').toLowerCase();
    return code === '23505' || message.includes('unique constraint') || message.includes('duplicate key');
}
/**
 * Crea los intents de UNA orden con la configuración de LA TIENDA QUE VENDIÓ.
 *
 * Todo lo que se lee acá se SELLA en `gift_card_delivery` —`expires_at` sale de
 * `default_expiry_days`, más `timezone`, `scheduled_at` y el diseño por defecto— y no
 * se vuelve a mirar: si sale de la fila global, la entrega queda mal para siempre
 * aunque después alguien arregle la configuración de la tienda. Por eso la tienda se
 * resuelve acá y no en el envío, que ya es tarde.
 *
 * `settings.enabled` también pasa a ser por tienda, y eso NO deja nada colgado: los
 * intents se crean de cero en cada pasada, así que una tienda con la experiencia
 * apagada simplemente no crea ninguno. Es distinto del gate de los JOBS, que corre
 * DESPUÉS de reclamar filas y por eso sigue siendo de lote (ver `delivery.ts`).
 */
async function createGiftCardIntentsForOrder(container, order) {
    const service = container.resolve(_1.GIFT_CARD_EXPERIENCE_MODULE);
    const settings = await service.getSettings(await (0, resolve_site_1.siteIdOfChannel)(container, order.sales_channel_id));
    if (!isGiftCardExperienceEnabled(settings.enabled))
        return [];
    const defaultDesign = await service.ensureDefaultDesign();
    const intents = [];
    for (const item of (order.items ?? []).filter((candidate) => candidate.product?.is_giftcard === true)) {
        const config = (0, gift_cards_shared_1.normalizeGiftCardConfig)(item.metadata ?? {}, settings.default_design_id);
        (0, gift_cards_shared_1.assertGiftCardBuyerIsNotRecipient)(config, order.email);
        const design = await service.resolveDesign(config.design_id, true) ?? defaultDesign;
        const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1));
        const faceValue = Number(item.unit_price) || 0;
        const paidPerUnit = Number(item.total ?? faceValue * quantity) / quantity;
        const scheduledAt = (0, schedule_1.resolveScheduledAt)(config.delivery, settings);
        const expiresAt = settings.default_expiry_days
            ? new Date(Date.now() + settings.default_expiry_days * 86_400_000)
            : null;
        for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
            const result = await service.createDeliveryIntent({
                idempotency_key: `gift-card:${order.id}:${item.id}:${unitIndex}`,
                order_id: order.id,
                order_display_id: order.display_id ?? null,
                line_item_id: item.id,
                unit_index: unitIndex,
                buyer_customer_id: order.customer_id ?? null,
                buyer_email: order.email,
                config,
                design,
                currency_code: order.currency_code,
                face_value: faceValue,
                paid_amount: paidPerUnit,
                timezone: settings.timezone,
                scheduled_at: scheduledAt,
                expires_at: expiresAt,
            });
            intents.push(result.delivery);
        }
    }
    return intents;
}
async function issueIntent(container, service, delivery) {
    const claimed = await service.claimIssuance(delivery.id, new Date());
    if (!claimed)
        return;
    try {
        let giftCard = await service.findOfficialGiftCardByIdempotencyKey(claimed.idempotency_key);
        if (!giftCard) {
            for (let collisionAttempt = 0; collisionAttempt < 3 && !giftCard; collisionAttempt += 1) {
                const workflowInput = [{
                        value: Number(claimed.face_value),
                        currency_code: claimed.currency_code,
                        expires_at: claimed.expires_at ? new Date(claimed.expires_at).toISOString() : null,
                        reference: 'order',
                        reference_id: claimed.order_id,
                        line_item_id: claimed.line_item_id,
                        customer_id: null,
                        metadata: {
                            idempotency_key: claimed.idempotency_key,
                            gift_card_delivery_id: claimed.id,
                            unit_index: claimed.unit_index,
                        },
                    }];
                try {
                    // The plugin runtime explicitly generates a crypto code when omitted,
                    // although its published 2.17.2 TypeScript DTO still marks `code` required.
                    const { result } = await (0, workflows_1.createGiftCardsWorkflow)(container).run({
                        input: workflowInput,
                    });
                    const created = result[0];
                    if (!created)
                        throw new Error('El workflow oficial no devolvió la gift card emitida.');
                    giftCard = { id: created.id, code: created.code };
                }
                catch (error) {
                    // Rebuild the input on each attempt so the plugin generates a fresh
                    // cryptographic code. All other failures are non-retryable here.
                    if (!isUniqueConstraintError(error) || collisionAttempt === 2)
                        throw error;
                }
            }
        }
        if (!giftCard)
            throw new Error('No se pudo emitir una gift card única.');
        const selfClaim = claimed.delivery_mode === 'self' && claimed.buyer_customer_id;
        if (selfClaim) {
            await (0, workflows_1.claimGiftCardWorkflow)(container).run({
                input: { code: giftCard.code, customer_id: claimed.buyer_customer_id },
            });
        }
        const account = await resolveBackingAccount(container, giftCard.id);
        await service.markIssued(claimed.id, {
            giftCardId: giftCard.id,
            storeCreditAccountId: account?.id ?? null,
            deliveryStatus: selfClaim ? 'sent' : claimed.scheduled_at ? 'scheduled' : 'pending',
            claimedCustomerId: selfClaim ? claimed.buyer_customer_id : null,
        });
    }
    catch (error) {
        await service.markIssuanceFailed(claimed.id, error);
        throw error;
    }
}
async function resolveBackingAccount(container, giftCardId) {
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
        entity: 'gift_card',
        fields: ['id', 'store_credit_accounts.id', 'store_credit_accounts.code'],
        filters: { id: giftCardId },
    });
    const row = data[0];
    return row?.store_credit_accounts?.[0] ?? null;
}
async function processGiftCardsForOrder(container, orderId) {
    const order = await retrieveOrder(container, orderId);
    if (!order)
        return { paid: false, intentCount: 0 };
    const service = container.resolve(_1.GIFT_CARD_EXPERIENCE_MODULE);
    if (order.canceled_at || order.status === 'canceled') {
        const canceled = await service.cancelUnissuedDeliveriesForOrder(order.id);
        return { paid: false, intentCount: canceled };
    }
    const intents = await createGiftCardIntentsForOrder(container, order);
    if (!isFullyPaidOrder(order))
        return { paid: false, intentCount: intents.length };
    for (const intent of intents)
        await issueIntent(container, service, intent);
    return { paid: true, intentCount: intents.length };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzcy1vcmRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2dpZnQtY2FyZC1leHBlcmllbmNlL3Byb2Nlc3Mtb3JkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFvREEsa0VBRUM7QUFxQkQsd0NBSUM7QUFFRCw0Q0FHQztBQUVELDBEQUtDO0FBZ0JELHNFQTRDQztBQWlFRCxzREFjQztBQUVELDREQWVDO0FBdFBELHFEQUFzRTtBQUN0RSxrRUFJNEM7QUFDNUMsbUVBR3FDO0FBQ3JDLG9FQUFvRTtBQUNwRSx3QkFBZ0Q7QUFFaEQseUNBQWdEO0FBQ2hELHlDQUEyRDtBQWlDM0Q7OztHQUdHO0FBQ0gsU0FBZ0IsMkJBQTJCLENBQUMsZUFBd0I7SUFDbEUsT0FBTyxJQUFBLHdDQUE2QixHQUFFLENBQUMsaUJBQWlCLElBQUksZUFBZSxDQUFDO0FBQzlFLENBQUM7QUFFRCxLQUFLLFVBQVUsYUFBYSxDQUFDLFNBQTBCLEVBQUUsT0FBZTtJQUN0RSxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGlDQUF5QixDQUFDLEtBQUssQ0FFOUQsQ0FBQztJQUNGLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUM7UUFDakMsTUFBTSxFQUFFLE9BQU87UUFDZixNQUFNLEVBQUU7WUFDTixJQUFJLEVBQUUsWUFBWSxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsYUFBYTtZQUM3RixrQkFBa0I7WUFDbEIsVUFBVSxFQUFFLGdCQUFnQixFQUFFLGtCQUFrQixFQUFFLGFBQWEsRUFBRSxnQkFBZ0I7WUFDakYsMkJBQTJCO1lBQzNCLHFDQUFxQyxFQUFFLDBDQUEwQztZQUNqRiwwQ0FBMEM7U0FDM0M7UUFDRCxPQUFPLEVBQUUsRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFO0tBQ3pCLENBQUMs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