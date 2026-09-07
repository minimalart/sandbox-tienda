"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ga4EventMapping = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.Ga4EventMapping = utils_1.model
    .define('ga4_event_mapping', {
    id: utils_1.model
        .id({
        prefix: 'ga4map',
    })
        .primaryKey(),
    medusa_event: utils_1.model.text(),
    ga4_event_name: utils_1.model.text(),
    is_active: utils_1.model.boolean().default(true),
    description: utils_1.model.text().nullable(),
    // Array of { ga4_param, source_path?, static_value? }
    param_mappings: utils_1.model.json().nullable(),
    metadata: utils_1.model.json().nullable(),
    /**
     * La tienda dueña de esta fila. `NULL` = GLOBAL, el fallback de toda tienda que no
     * defina la suya para esa clave.
     *
     * Sirve para que una marca mida un evento propio (o le cambie el nombre) sin
     * tocárselo a las otras, que comparten el mapeo por defecto.
     */
    site_id: utils_1.model.text().nullable(),
})
    .indexes([
    // DOS parciales: en Postgres `NULL != NULL`, así que uno solo sobre
    // (site_id, medusa_event, ga4_event_name) dejaría pasar dos globales idénticos.
    {
        on: ['medusa_event', 'ga4_event_name'],
        unique: true,
        where: 'site_id IS NULL AND deleted_at IS NULL',
    },
    {
        on: ['site_id', 'medusa_event', 'ga4_event_name'],
        unique: true,
        where: 'site_id IS NOT NULL AND deleted_at IS NULL',
    },
    { on: ['site_id'] },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnQtbWFwcGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2dhNC9tb2RlbHMvZXZlbnQtbWFwcGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFFckMsUUFBQSxlQUFlLEdBQUcsYUFBSztLQUNqQyxNQUFNLENBQUMsbUJBQW1CLEVBQUU7SUFDM0IsRUFBRSxFQUFFLGFBQUs7U0FDTixFQUFFLENBQUM7UUFDRixNQUFNLEVBQUUsUUFBUTtLQUNqQixDQUFDO1NBQ0QsVUFBVSxFQUFFO0lBQ2YsWUFBWSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDMUIsY0FBYyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDNUIsU0FBUyxFQUFFLGFBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0lBQ3hDLFdBQVcsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3BDLHNEQUFzRDtJQUN0RCxjQUFjLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN2QyxRQUFRLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNqQzs7Ozs7O09BTUc7SUFDSCxPQUFPLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNqQyxDQUFDO0tBQ0QsT0FBTyxDQUFDO0lBQ1Asb0VBQW9FO0lBQ3BFLGdGQUFnRjtJQUNoRjtRQUNFLEVBQUUsRUFBRSxDQUFDLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQztRQUN0QyxNQUFNLEVBQUUsSUFBSTtRQUNaLEtBQUssRUFBRSx3Q0FBd0M7S0FDaEQ7SUFDRDtRQUNFLEVBQUUsRUFBRSxDQUFDLFNBQVMsRUFBRSxjQUFjLEVBQUUsZ0JBQWdCLENBQUM7UUFDakQsTUFBTSxFQUFFLElBQUk7UUFDWixLQUFLLEVBQUUsNENBQTRDO0tBQ3BEO0lBQ0QsRUFBRSxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsRUFBRTtDQUNwQixDQUFDLENBQUMifQ==