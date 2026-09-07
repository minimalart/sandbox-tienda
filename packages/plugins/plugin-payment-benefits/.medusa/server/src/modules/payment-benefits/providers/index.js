"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDERS = void 0;
exports.getProvider = getProvider;
const manual_adapter_1 = require("./manual-adapter");
const mercadopago_adapter_1 = require("./mercadopago-adapter");
/**
 * Registro de adapters por código de proveedor. Agregar un proveedor nuevo
 * (MODO, Payway, …) es solo sumar su adapter acá; ni el modelo ni la UI cambian.
 */
exports.PROVIDERS = {
    mercadopago: mercadopago_adapter_1.mercadoPagoAdapter,
    manual: manual_adapter_1.manualAdapter,
};
function getProvider(code) {
    return exports.PROVIDERS[code] ?? null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9wYXltZW50LWJlbmVmaXRzL3Byb3ZpZGVycy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFjQSxrQ0FFQztBQWZELHFEQUFpRDtBQUNqRCwrREFBMkQ7QUFHM0Q7OztHQUdHO0FBQ1UsUUFBQSxTQUFTLEdBQTJDO0lBQy9ELFdBQVcsRUFBRSx3Q0FBa0I7SUFDL0IsTUFBTSxFQUFFLDhCQUFhO0NBQ3RCLENBQUM7QUFFRixTQUFnQixXQUFXLENBQUMsSUFBa0M7SUFDNUQsT0FBTyxpQkFBUyxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQztBQUNqQyxDQUFDIn0=