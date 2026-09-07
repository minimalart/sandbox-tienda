"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbandonedCartNotification = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Una fila por intento de envío (paso + canal). Da idempotencia (constraint único
 * `abandoned_cart_id + step + channel`, ver migración) y trazabilidad de la
 * secuencia: qué se envió, cuándo y con qué resultado.
 */
exports.AbandonedCartNotification = utils_1.model
    .define('abandoned_cart_notification', {
    id: utils_1.model.id({ prefix: 'abcn' }).primaryKey(),
    abandoned_cart_id: utils_1.model.text(),
    step: utils_1.model.number(),
    channel: utils_1.model.text(),
    // Key lógica del template usado (ej. `cart-abandoned-1`).
    template: utils_1.model.text().nullable(),
    // Destinatario efectivo (email o teléfono).
    recipient: utils_1.model.text().nullable(),
    status: utils_1.model.text().default('sent'),
    error: utils_1.model.text().nullable(),
    sent_at: utils_1.model.dateTime().nullable(),
})
    .indexes([
    { on: ['abandoned_cart_id'] },
    { on: ['abandoned_cart_id', 'step', 'channel'], unique: true },
]);
exports.default = exports.AbandonedCartNotification;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJhbmRvbmVkLWNhcnQtbm90aWZpY2F0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvYWJhbmRvbmVkLWNhcnQvbW9kZWxzL2FiYW5kb25lZC1jYXJ0LW5vdGlmaWNhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFFbEQ7Ozs7R0FJRztBQUNVLFFBQUEseUJBQXlCLEdBQUcsYUFBSztLQUMzQyxNQUFNLENBQUMsNkJBQTZCLEVBQUU7SUFDckMsRUFBRSxFQUFFLGFBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUU7SUFDN0MsaUJBQWlCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUMvQixJQUFJLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRTtJQUNwQixPQUFPLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNyQiwwREFBMEQ7SUFDMUQsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsNENBQTRDO0lBQzVDLFNBQVMsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2xDLE1BQU0sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztJQUNwQyxLQUFLLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM5QixPQUFPLEVBQUUsYUFBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNyQyxDQUFDO0tBQ0QsT0FBTyxDQUFDO0lBQ1AsRUFBRSxFQUFFLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFO0lBQzdCLEVBQUUsRUFBRSxFQUFFLENBQUMsbUJBQW1CLEVBQUUsTUFBTSxFQUFFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUU7Q0FDL0QsQ0FBQyxDQUFDO0FBRUwsa0JBQWUsaUNBQXlCLENBQUMifQ==