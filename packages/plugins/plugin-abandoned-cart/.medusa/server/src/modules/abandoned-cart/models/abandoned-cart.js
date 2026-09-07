"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbandonedCart = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Seguimiento de un carrito abandonado. Una fila por `cart_id`. Guarda solo lo
 * necesario para orquestar la secuencia y mostrar métricas (valor snapshot,
 * contacto, estado); el detalle del carrito se relee en vivo desde el módulo core.
 */
exports.AbandonedCart = utils_1.model
    .define('abandoned_cart', {
    id: utils_1.model.id({ prefix: 'abc' }).primaryKey(),
    cart_id: utils_1.model.text(),
    email: utils_1.model.text().nullable(),
    phone: utils_1.model.text().nullable(),
    customer_id: utils_1.model.text().nullable(),
    sales_channel_id: utils_1.model.text().nullable(),
    // Snapshot del total (en la unidad del carrito) para métricas de valor recuperable.
    cart_total: utils_1.model.number().nullable(),
    currency_code: utils_1.model.text().nullable(),
    status: utils_1.model.text().default('pending'),
    // Último paso de la secuencia efectivamente enviado (0 = ninguno).
    last_step_sent: utils_1.model.number().default(0),
    // Cuándo vuelve a ser elegible para el próximo paso (null si no hay más).
    next_eligible_at: utils_1.model.dateTime().nullable(),
    // Última actividad conocida del carrito (updated_at del core), para calcular idle.
    last_activity_at: utils_1.model.dateTime().nullable(),
    recovered_order_id: utils_1.model.text().nullable(),
    metadata: utils_1.model.json().nullable(),
})
    .indexes([
    { on: ['cart_id'], unique: true },
    { on: ['status'] },
    { on: ['next_eligible_at'] },
]);
exports.default = exports.AbandonedCart;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJhbmRvbmVkLWNhcnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9hYmFuZG9uZWQtY2FydC9tb2RlbHMvYWJhbmRvbmVkLWNhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRWxEOzs7O0dBSUc7QUFDVSxRQUFBLGFBQWEsR0FBRyxhQUFLO0tBQy9CLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRTtJQUN4QixFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM1QyxPQUFPLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNyQixLQUFLLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM5QixLQUFLLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM5QixXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQyxnQkFBZ0IsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3pDLG9GQUFvRjtJQUNwRixVQUFVLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNyQyxhQUFhLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN0QyxNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUM7SUFDdkMsbUVBQW1FO0lBQ25FLGNBQWMsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUN6QywwRUFBMEU7SUFDMUUsZ0JBQWdCLEVBQUUsYUFBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM3QyxtRkFBbUY7SUFDbkYsZ0JBQWdCLEVBQUUsYUFBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM3QyxrQkFBa0IsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzNDLFFBQVEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ2xDLENBQUM7S0FDRCxPQUFPLENBQUM7SUFDUCxFQUFFLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUU7SUFDakMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRTtJQUNsQixFQUFFLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLEVBQUU7Q0FDN0IsQ0FBQyxDQUFDO0FBRUwsa0JBQWUscUJBQWEsQ0FBQyJ9