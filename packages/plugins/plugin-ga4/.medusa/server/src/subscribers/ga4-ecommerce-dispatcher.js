"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = ga4EcommerceDispatcherHandler;
const utils_1 = require("@medusajs/framework/utils");
const ga4_1 = require("../modules/ga4");
const supported_events_1 = require("../modules/ga4/lib/supported-events");
/**
 * Dispatcher de los eventos del embudo ecommerce (portados del plugin
 * @variablevic/google-analytics-medusa, ahora desactivado). Escucha los eventos
 * Medusa que los disparan y enruta al built-in correspondiente. Cada built-in
 * chequea su propio setting (activo + nombre GA4) en el servicio.
 *
 * No-op si falta el measurement id o el api secret, sea cual sea su origen
 * (card de app-settings, fila legacy `ga4_settings` o env). Nunca lanza.
 */
async function ga4EcommerceDispatcherHandler({ event, container, }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    try {
        const ga4Service = container.resolve(ga4_1.GA4_MODULE);
        // No-op cuando el tracking server-side no está configurado (config en DB).
        if (!(await ga4Service.isConfigured())) {
            return;
        }
        const data = event.data;
        switch (event.name) {
            case 'order.placed':
                await ga4Service.dispatchBuiltin('purchase', data, container);
                break;
            case 'payment-session.created':
                await ga4Service.dispatchBuiltin('add_payment_info', data, container);
                break;
            case 'payment.refunded':
                await ga4Service.dispatchBuiltin('refund', data, container);
                break;
            case 'cart.updated': {
                const changes = data.changes;
                if (changes?.line_items) {
                    if (changes.line_items.action === 'added') {
                        await ga4Service.dispatchBuiltin('add_to_cart', data, container);
                    }
                    else if (changes.line_items.action === 'deleted') {
                        await ga4Service.dispatchBuiltin('remove_from_cart', data, container);
                    }
                }
                else if (changes?.shipping_address) {
                    await ga4Service.dispatchBuiltin('add_shipping_info', data, container);
                }
                break;
            }
        }
    }
    catch (error) {
        logger.warn(`[GA4] No se pudo despachar evento ecommerce (${event.name}): ${error.message}`);
    }
}
exports.config = {
    event: supported_events_1.BUILTIN_TRIGGER_EVENTS,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2E0LWVjb21tZXJjZS1kaXNwYXRjaGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3N1YnNjcmliZXJzL2dhNC1lY29tbWVyY2UtZGlzcGF0Y2hlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFnQkEsZ0RBZ0RDO0FBL0RELHFEQUFzRTtBQUV0RSx3Q0FBNEM7QUFFNUMsMEVBQTZFO0FBRTdFOzs7Ozs7OztHQVFHO0FBQ1ksS0FBSyxVQUFVLDZCQUE2QixDQUFDLEVBQzFELEtBQUssRUFDTCxTQUFTLEdBQzREO0lBQ3JFLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQVMsaUNBQXlCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFM0UsSUFBSSxDQUFDO1FBQ0gsTUFBTSxVQUFVLEdBQXFCLFNBQVMsQ0FBQyxPQUFPLENBQUMsZ0JBQVUsQ0FBQyxDQUFDO1FBRW5FLDJFQUEyRTtRQUMzRSxJQUFJLENBQUMsQ0FBQyxNQUFNLFVBQVUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDdkMsT0FBTztRQUNULENBQUM7UUFFRCxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1FBRXhCLFFBQVEsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ25CLEtBQUssY0FBYztnQkFDakIsTUFBTSxVQUFVLENBQUMsZUFBZSxDQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7Z0JBQzlELE1BQU07WUFFUixLQUFLLHlCQUF5QjtnQkFDNUIsTUFBTSxVQUFVLENBQUMsZUFBZSxDQUFDLGtCQUFrQixFQUFFLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztnQkFDdEUsTUFBTTtZQUVSLEtBQUssa0JBQWtCO2dCQUNyQixNQUFNLFVBQVUsQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztnQkFDNUQsTUFBTTtZQUVSLEtBQUssY0FBYyxDQUFDLENBQUMsQ0FBQztnQkFDcEIsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztnQkFDN0IsSUFBSSxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUM7b0JBQ3hCLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEtBQUssT0FBTyxFQUFFLENBQUM7d0JBQzFDLE1BQU0sVUFBVSxDQUFDLGVBQWUsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO29CQUNuRSxDQUFDO3lCQUFNLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEtBQUssU0FBUyxFQUFFLENBQUM7d0JBQ25ELE1BQU0sVUFBVSxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBQ3hFLENBQUM7Z0JBQ0gsQ0FBQztxQkFBTSxJQUFJLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxDQUFDO29CQUNyQyxNQUFNLFVBQVUsQ0FBQyxlQUFlLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO2dCQUN6RSxDQUFDO2dCQUNELE1BQU07WUFDUixDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxDQUFDLElBQUksQ0FDVCxnREFBZ0QsS0FBSyxDQUFDLElBQUksTUFBTyxLQUFlLENBQUMsT0FBTyxFQUFFLENBQzNGLENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQztBQUVZLFFBQUEsTUFBTSxHQUFxQjtJQUN0QyxLQUFLLEVBQUUseUNBQXNCO0NBQzlCLENBQUMifQ==