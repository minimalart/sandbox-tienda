"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_BENEFITS_MODULE = void 0;
/**
 * Beneficios de Pago. Muestra en storefront/backoffice los beneficios asociados
 * a los medios de pago (cuotas, descuentos, reintegros, promos bancarias/wallet).
 *
 * A diferencia de las Promotions comerciales de Medusa (que mueven el precio),
 * estos beneficios son INFORMATIVOS: nunca modifican el precio del producto.
 *
 * Origen de los datos (validado contra la API de Mercado Pago):
 *  - medios de pago  → GET /v1/payment_methods            (sync)
 *  - cuotas          → GET /v1/payment_methods/installments (sync, snapshot por monto)
 *  - descuentos / reintegros / cashback / promos bancarias → MANUAL (MP no los
 *    expone por API pública de lectura para terceros).
 */
exports.PAYMENT_BENEFITS_MODULE = 'payment_benefits';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9wYXltZW50LWJlbmVmaXRzL3R5cGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBOzs7Ozs7Ozs7Ozs7R0FZRztBQUNVLFFBQUEsdUJBQXVCLEdBQUcsa0JBQWtCLENBQUMifQ==