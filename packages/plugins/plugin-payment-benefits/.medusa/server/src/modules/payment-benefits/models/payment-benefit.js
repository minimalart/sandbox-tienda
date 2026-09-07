"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentBenefit = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Beneficio de pago curado. Puede ser MANUAL (editable) o SINCRONIZADO desde un
 * proveedor (read_only=true → los campos oficiales no se editan, solo
 * visibilidad/prioridad/notas/canales).
 *
 * Nunca toca el precio del producto: es informativo (PRD §14).
 * `eligibility` y `conditions` van como JSON para no explotar en tablas/joins.
 * `sales_channel_ids` scopea por demo (patrón banner/brand): vacío = todos.
 */
exports.PaymentBenefit = utils_1.model
    .define('payment_benefit', {
    id: utils_1.model.id({ prefix: 'pbnf' }).primaryKey(),
    provider_code: utils_1.model.text().default('manual'),
    external_id: utils_1.model.text().nullable(),
    title: utils_1.model.text(),
    description: utils_1.model.text().nullable(),
    // 'installments' | 'percentage_discount' | 'fixed_discount' | 'refund' | 'cashback' | 'custom'
    benefit_type: utils_1.model.text().default('custom'),
    // Campos numéricos del beneficio (todos opcionales según el tipo).
    discount_type: utils_1.model.text().nullable(),
    discount_value: utils_1.model.number().nullable(),
    max_installments: utils_1.model.number().nullable(),
    interest_rate: utils_1.model.number().nullable(),
    max_refund: utils_1.model.number().nullable(),
    minimum_amount: utils_1.model.number().nullable(),
    maximum_amount: utils_1.model.number().nullable(),
    // 'manual' | 'mercadopago' | ...
    source: utils_1.model.text().default('manual'),
    // Los beneficios sincronizados son de solo lectura en sus campos oficiales.
    read_only: utils_1.model.boolean().default(false),
    // 'draft' | 'scheduled' | 'active' | 'expired' | 'disabled' | 'sync_error'
    status: utils_1.model.text().default('draft'),
    priority: utils_1.model.number().default(0),
    valid_from: utils_1.model.dateTime().nullable(),
    valid_to: utils_1.model.dateTime().nullable(),
    // { scope, ids[] }
    eligibility: utils_1.model.json().nullable(),
    // { card_brand?, issuer?, payment_method?, wallet?, country?, currency? }
    conditions: utils_1.model.json().nullable(),
    // string[] — vacío/null = todos los canales.
    sales_channel_ids: utils_1.model.json().nullable(),
    // Observación editable por el admin aun en beneficios read-only.
    admin_notes: utils_1.model.text().nullable(),
    // El admin puede ocultar un beneficio (incluso sincronizado) sin borrarlo.
    hidden: utils_1.model.boolean().default(false),
    last_synced_at: utils_1.model.dateTime().nullable(),
    metadata: utils_1.model.json().nullable(),
})
    .indexes([
    { on: ['status'] },
    { on: ['provider_code'] },
    { on: ['benefit_type'] },
]);
exports.default = exports.PaymentBenefit;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF5bWVudC1iZW5lZml0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvcGF5bWVudC1iZW5lZml0cy9tb2RlbHMvcGF5bWVudC1iZW5lZml0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUVsRDs7Ozs7Ozs7R0FRRztBQUNVLFFBQUEsY0FBYyxHQUFHLGFBQUs7S0FDaEMsTUFBTSxDQUFDLGlCQUFpQixFQUFFO0lBQ3pCLEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFO0lBQzdDLGFBQWEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQztJQUM3QyxXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQyxLQUFLLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUNuQixXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQywrRkFBK0Y7SUFDL0YsWUFBWSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDO0lBQzVDLG1FQUFtRTtJQUNuRSxhQUFhLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN0QyxjQUFjLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN6QyxnQkFBZ0IsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzNDLGFBQWEsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3hDLFVBQVUsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3JDLGNBQWMsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3pDLGNBQWMsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3pDLGlDQUFpQztJQUNqQyxNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUM7SUFDdEMsNEVBQTRFO0lBQzVFLFNBQVMsRUFBRSxhQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztJQUN6QywyRUFBMkU7SUFDM0UsTUFBTSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO0lBQ3JDLFFBQVEsRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNuQyxVQUFVLEVBQUUsYUFBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN2QyxRQUFRLEVBQUUsYUFBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNyQyxtQkFBbUI7SUFDbkIsV0FBVyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDcEMsMEVBQTBFO0lBQzFFLFVBQVUsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ25DLDZDQUE2QztJQUM3QyxpQkFBaUIsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzFDLGlFQUFpRTtJQUNqRSxXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQywyRUFBMkU7SUFDM0UsTUFBTSxFQUFFLGFBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0lBQ3RDLGNBQWMsRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzNDLFFBQVEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ2xDLENBQUM7S0FDRCxPQUFPLENBQUM7SUFDUCxFQUFFLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFO0lBQ2xCLEVBQUUsRUFBRSxFQUFFLENBQUMsZUFBZSxDQUFDLEVBQUU7SUFDekIsRUFBRSxFQUFFLEVBQUUsQ0FBQyxjQUFjLENBQUMsRUFBRTtDQUN6QixDQUFDLENBQUM7QUFFTCxrQkFBZSxzQkFBYyxDQUFDIn0=