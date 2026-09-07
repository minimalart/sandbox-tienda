"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentSyncLog = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Historial de sincronizaciones por proveedor. Alimenta el dashboard del
 * backoffice ("última sincronización", "errores de sincronización").
 */
exports.PaymentSyncLog = utils_1.model
    .define('payment_sync_log', {
    id: utils_1.model.id({ prefix: 'psl' }).primaryKey(),
    provider_code: utils_1.model.text(),
    // 'ok' | 'error'
    status: utils_1.model.text().default('ok'),
    items_synced: utils_1.model.number().default(0),
    message: utils_1.model.text().nullable(),
    started_at: utils_1.model.dateTime().nullable(),
    finished_at: utils_1.model.dateTime().nullable(),
})
    .indexes([{ on: ['provider_code'] }, { on: ['status'] }]);
exports.default = exports.PaymentSyncLog;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF5bWVudC1zeW5jLWxvZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3BheW1lbnQtYmVuZWZpdHMvbW9kZWxzL3BheW1lbnQtc3luYy1sb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRWxEOzs7R0FHRztBQUNVLFFBQUEsY0FBYyxHQUFHLGFBQUs7S0FDaEMsTUFBTSxDQUFDLGtCQUFrQixFQUFFO0lBQzFCLEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFO0lBQzVDLGFBQWEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQzNCLGlCQUFpQjtJQUNqQixNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDbEMsWUFBWSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3ZDLE9BQU8sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2hDLFVBQVUsRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3ZDLFdBQVcsRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ3pDLENBQUM7S0FDRCxPQUFPLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLGVBQWUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUU1RCxrQkFBZSxzQkFBYyxDQUFDIn0=