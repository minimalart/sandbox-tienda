"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAMPLE_BINS = exports.INSTALLMENTS_REFERENCE_AMOUNT = exports.MP_API_BASE = void 0;
exports.isMpBenefitsSyncEnabled = isMpBenefitsSyncEnabled;
const mercatto_plugin_runtime_1 = require("@minimalart/mercatto-plugin-runtime");
/**
 * Constantes de la extensión Beneficios de Pago.
 */
/** Base de la REST API de Mercado Pago (el SDK npm no envuelve estos GET). */
exports.MP_API_BASE = 'https://api.mercadopago.com';
/**
 * Monto de referencia (unidad mayor, ARS) para el snapshot de cuotas. El
 * endpoint /v1/payment_methods/installments exige un `amount`; guardamos el
 * máximo de cuotas sin interés observado para este monto. Es aproximado — la
 * cifra exacta por precio queda para la fase 2 (consulta en vivo).
 */
exports.INSTALLMENTS_REFERENCE_AMOUNT = 10000;
/**
 * BIN de ejemplo por medio de pago de tarjeta para poder consultar installments
 * (el endpoint acepta payment_method_id + bin). Son BINs públicos de prueba de
 * las marcas; solo se usan para descubrir el plan de cuotas del comercio.
 */
exports.SAMPLE_BINS = {
    visa: '450799',
    master: '503175',
    amex: '371180',
    naranja: '589562',
    cabal: '604201',
    maestro: '501080',
};
/** ¿Está habilitado el sync con Mercado Pago? Reutiliza el token del provider. */
function isMpBenefitsSyncEnabled(env = process.env) {
    const saved = env === process.env
        ? (0, mercatto_plugin_runtime_1.getAppSettingsSyncReader)()?.('extension:mercadopago', 'MERCADOPAGO_ACCESS_TOKEN')
        : undefined;
    return Boolean(saved || env.MERCADOPAGO_ACCESS_TOKEN);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvcGF5bWVudC1iZW5lZml0cy9jb25zdGFudHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBK0JBLDBEQU1DO0FBckNELGlGQUErRTtBQUMvRTs7R0FFRztBQUVILDhFQUE4RTtBQUNqRSxRQUFBLFdBQVcsR0FBRyw2QkFBNkIsQ0FBQztBQUV6RDs7Ozs7R0FLRztBQUNVLFFBQUEsNkJBQTZCLEdBQUcsS0FBSyxDQUFDO0FBRW5EOzs7O0dBSUc7QUFDVSxRQUFBLFdBQVcsR0FBMkI7SUFDakQsSUFBSSxFQUFFLFFBQVE7SUFDZCxNQUFNLEVBQUUsUUFBUTtJQUNoQixJQUFJLEVBQUUsUUFBUTtJQUNkLE9BQU8sRUFBRSxRQUFRO0lBQ2pCLEtBQUssRUFBRSxRQUFRO0lBQ2YsT0FBTyxFQUFFLFFBQVE7Q0FDbEIsQ0FBQztBQUVGLGtGQUFrRjtBQUNsRixTQUFnQix1QkFBdUIsQ0FBQyxNQUF5QixPQUFPLENBQUMsR0FBRztJQUMxRSxNQUFNLEtBQUssR0FDVCxHQUFHLEtBQUssT0FBTyxDQUFDLEdBQUc7UUFDakIsQ0FBQyxDQUFDLElBQUEsa0RBQXdCLEdBQUUsRUFBRSxDQUFDLHVCQUF1QixFQUFFLDBCQUEwQixDQUFDO1FBQ25GLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDaEIsT0FBTyxPQUFPLENBQUMsS0FBSyxJQUFJLEdBQUcsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0FBQ3hELENBQUMifQ==