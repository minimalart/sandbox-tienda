"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyAbandonedCartWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const utils_1 = require("@medusajs/framework/utils");
const abandoned_cart_1 = require("../modules/abandoned-cart");
const lib_1 = require("../modules/abandoned-cart/lib");
/** Normaliza `cart.order`, que según el link puede llegar como objeto o array. */
function orderIdOf(cart) {
    const ref = Array.isArray(cart.order) ? cart.order[0] : cart.order;
    return ref?.id ?? null;
}
/**
 * Relee el carrito en vivo, decide qué paso enviar y arma el payload. Si el
 * carrito ya se completó (carrera con una orden), lo marca recuperado y salta.
 */
const prepareStep = (0, workflows_sdk_1.createStep)('prepare-abandoned-cart-notification', async (input, { container }) => {
    const service = container.resolve(abandoned_cart_1.ABANDONED_CART_MODULE);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const config = service.getConfig();
    const now = new Date();
    const skip = (reason) => new workflows_sdk_1.StepResponse({
        skip: true,
        reason,
        abandonedCartId: input.abandonedCartId,
        step: 0,
        email: null,
        phone: null,
        emailTemplate: null,
        whatsappTemplate: null,
        data: {},
    });
    let record;
    try {
        record = await service.retrieveAbandonedCart(input.abandonedCartId);
    }
    catch {
        return skip('tracking-not-found');
    }
    if (record.status === 'recovered' || record.status === 'cancelled') {
        return skip(`status-${record.status}`);
    }
    let cart;
    try {
        const { data } = (await query.graph({
            entity: 'cart',
            fields: [
                'id',
                'email',
                'completed_at',
                'updated_at',
                'total',
                'currency_code',
                // La tienda del carrito: el mail de recupero tiene que salir con SU marca —
                // es el que le pide al comprador volver a una tienda concreta.
                'sales_channel_id',
                'items.id',
                'order.id',
                'customer.first_name',
                'customer.last_name',
                'customer.phone',
                'shipping_address.first_name',
                'shipping_address.last_name',
                'shipping_address.phone',
                'shipping_address.country_code',
            ],
            filters: { id: record.cart_id },
        }));
        cart = data[0];
    }
    catch {
        return skip('cart-read-failed');
    }
    if (!cart)
        return skip('cart-missing');
    if (cart.completed_at) {
        // Se resuelve la orden por el link cart→order: pasar null acá dejaba
        // `recovered_order_id` vacío y perdía la atribución de valor recuperado.
        await service.markRecoveredByCartId(record.cart_id, orderIdOf(cart));
        return skip('cart-completed');
    }
    if (!cart.items || cart.items.length === 0)
        return skip('cart-empty');
    const step = input.forceStep
        ? config.steps.find((s) => s.step === input.forceStep) ?? null
        : service.resolveNextStep(record, config, now);
    if (!step)
        return skip('no-eligible-step');
    const email = (cart.email ?? record.email ?? null) || null;
    const phone = (cart.customer?.phone ??
        cart.shipping_address?.phone ??
        record.phone ??
        null) || null;
    // El tracking incluye carritos sin contacto (para medir el abandono real), y
    // el gate vive acá: sin destinatario no hay nada que enviar. Se saca de la cola
    // para no reintentar cada 15 minutos; si más adelante aparece un email o
    // teléfono, `upsertFromSnapshot` lo reprograma.
    if (!email && !phone) {
        await service.deferUntilContactable(record.id);
        return skip('no-contact');
    }
    const customerName = (0, lib_1.fullName)(cart.customer?.first_name, cart.customer?.last_name) ||
        (0, lib_1.fullName)(cart.shipping_address?.first_name, cart.shipping_address?.last_name);
    const data = {
        sales_channel_id: cart.sales_channel_id ?? undefined,
        cart_id: cart.id,
        customer_name: customerName || undefined,
        customer_email: email ?? undefined,
        total: (0, lib_1.formatMoney)(cart.total),
        currency_code: cart.currency_code?.toUpperCase() ?? undefined,
        item_count: cart.items.length,
        recovery_url: (0, lib_1.buildRecoveryUrl)(cart.id, cart.shipping_address?.country_code),
    };
    return new workflows_sdk_1.StepResponse({
        skip: false,
        abandonedCartId: record.id,
        step: step.step,
        email,
        phone,
        emailTemplate: step.emailTemplate,
        whatsappTemplate: step.whatsappTemplate,
        data,
    });
});
/**
 * Envía por los canales disponibles y registra el resultado (idempotente).
 * Nunca lanza por un fallo de envío: se registra `failed`/`skipped` y sigue.
 */
const dispatchStep = (0, workflows_sdk_1.createStep)('dispatch-abandoned-cart-notification', async (plan, { container }) => {
    if (plan.skip) {
        return new workflows_sdk_1.StepResponse({
            sent: 0,
            skipped: true,
            reason: plan.reason ?? null,
            step: null,
        });
    }
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const notificationService = container.resolve(utils_1.Modules.NOTIFICATION);
    const service = container.resolve(abandoned_cart_1.ABANDONED_CART_MODULE);
    const config = service.getConfig();
    const now = new Date();
    const results = [];
    if (plan.emailTemplate) {
        if (plan.email) {
            try {
                await notificationService.createNotifications({
                    to: plan.email,
                    channel: 'email',
                    template: plan.emailTemplate,
                    data: plan.data,
                });
                results.push({
                    channel: 'email',
                    template: plan.emailTemplate,
                    recipient: plan.email,
                    status: 'sent',
                });
            }
            catch (e) {
                const error = e.message;
                logger.warn(`[AbandonedCart] email paso ${plan.step} falló: ${error}`);
                results.push({
                    channel: 'email',
                    template: plan.emailTemplate,
                    recipient: plan.email,
                    status: 'failed',
                    error,
                });
            }
        }
        else {
            results.push({
                channel: 'email',
                template: plan.emailTemplate,
                recipient: null,
                status: 'skipped',
                error: 'no-email',
            });
        }
    }
    if (plan.whatsappTemplate) {
        if (plan.phone) {
            try {
                await notificationService.createNotifications({
                    to: plan.phone,
                    channel: 'whatsapp',
                    template: plan.whatsappTemplate,
                    data: plan.data,
                });
                results.push({
                    channel: 'whatsapp',
                    template: plan.whatsappTemplate,
                    recipient: plan.phone,
                    status: 'sent',
                });
            }
            catch (e) {
                const error = e.message;
                logger.warn(`[AbandonedCart] whatsapp paso ${plan.step} falló: ${error}`);
                results.push({
                    channel: 'whatsapp',
                    template: plan.whatsappTemplate,
                    recipient: plan.phone,
                    status: 'failed',
                    error,
                });
            }
        }
        else {
            results.push({
                channel: 'whatsapp',
                template: plan.whatsappTemplate,
                recipient: null,
                status: 'skipped',
                error: 'no-phone',
            });
        }
    }
    await service.recordStepResult({
        abandonedCartId: plan.abandonedCartId,
        step: plan.step,
        results,
        config,
        now,
    });
    const sent = results.filter((r) => r.status === 'sent').length;
    return new workflows_sdk_1.StepResponse({
        sent,
        skipped: false,
        reason: null,
        step: plan.step,
    });
});
exports.notifyAbandonedCartWorkflow = (0, workflows_sdk_1.createWorkflow)('notify-abandoned-cart', function (input) {
    const plan = prepareStep(input);
    const result = dispatchStep(plan);
    return new workflows_sdk_1.WorkflowResponse(result);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90aWZ5LWFiYW5kb25lZC1jYXJ0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3dvcmtmbG93cy9ub3RpZnktYWJhbmRvbmVkLWNhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUVBSzJDO0FBQzNDLHFEQUErRTtBQUUvRSw4REFBa0U7QUFNbEUsdURBQXdGO0FBMEN4RixrRkFBa0Y7QUFDbEYsU0FBUyxTQUFTLENBQUMsSUFBZTtJQUNoQyxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNuRSxPQUFPLEdBQUcsRUFBRSxFQUFFLElBQUksSUFBSSxDQUFDO0FBQ3pCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFdBQVcsR0FBRyxJQUFBLDBCQUFVLEVBQzVCLHFDQUFxQyxFQUNyQyxLQUFLLEVBQUUsS0FBK0IsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDdkQsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBNkIsc0NBQXFCLENBQUMsQ0FBQztJQUNyRixNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsT0FBTyxDQUU1QixpQ0FBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNwQyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsU0FBUyxFQUFFLENBQUM7SUFDbkMsTUFBTSxHQUFHLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztJQUV2QixNQUFNLElBQUksR0FBRyxDQUFDLE1BQWMsRUFBOEIsRUFBRSxDQUMxRCxJQUFJLDRCQUFZLENBQUM7UUFDZixJQUFJLEVBQUUsSUFBSTtRQUNWLE1BQU07UUFDTixlQUFlLEVBQUUsS0FBSyxDQUFDLGVBQWU7UUFDdEMsSUFBSSxFQUFF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