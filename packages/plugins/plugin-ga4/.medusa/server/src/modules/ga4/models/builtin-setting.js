"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ga4BuiltinSetting = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Config por evento built-in de ecommerce (purchase, add_to_cart, etc.). Guarda
 * SOLO el estado configurable: si está activo, si está oculto ("borrado") y un
 * override del nombre GA4. El payload lo arma el código (lib/builtin-dispatchers).
 * Una fila por builtin_key; si no existe fila, el default es activo, visible y
 * con el nombre del catálogo.
 */
exports.Ga4BuiltinSetting = utils_1.model
    .define('ga4_builtin_setting', {
    id: utils_1.model
        .id({
        prefix: 'ga4bi',
    })
        .primaryKey(),
    builtin_key: utils_1.model.text(),
    is_active: utils_1.model.boolean().default(true),
    // "Borrado" por el usuario: sale de la lista y nunca dispara. Como el catálogo
    // vive en código no se puede recrear de cero → es reversible (restaurar).
    hidden: utils_1.model.boolean().default(false),
    // Override del nombre de evento GA4; si es null se usa el default del catálogo.
    ga4_event_name: utils_1.model.text().nullable(),
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
    { on: ['builtin_key'], unique: true, where: 'site_id IS NULL AND deleted_at IS NULL' },
    { on: ['site_id', 'builtin_key'], unique: true, where: 'site_id IS NOT NULL AND deleted_at IS NULL' },
    { on: ['site_id'] },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbHRpbi1zZXR0aW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvZ2E0L21vZGVscy9idWlsdGluLXNldHRpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRWxEOzs7Ozs7R0FNRztBQUNVLFFBQUEsaUJBQWlCLEdBQUcsYUFBSztLQUNuQyxNQUFNLENBQUMscUJBQXFCLEVBQUU7SUFDN0IsRUFBRSxFQUFFLGFBQUs7U0FDTixFQUFFLENBQUM7UUFDRixNQUFNLEVBQUUsT0FBTztLQUNoQixDQUFDO1NBQ0QsVUFBVSxFQUFFO0lBQ2YsV0FBVyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDekIsU0FBUyxFQUFFLGFBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0lBQ3hDLCtFQUErRTtJQUMvRSwwRUFBMEU7SUFDMUUsTUFBTSxFQUFFLGFBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0lBQ3RDLGdGQUFnRjtJQUNoRixjQUFjLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN2Qzs7Ozs7O09BTUc7SUFDSCxPQUFPLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNqQyxDQUFDO0tBQ0QsT0FBTyxDQUFDO0lBQ1AsRUFBRSxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSx3Q0FBd0MsRUFBRTtJQUN0RixFQUFFLEVBQUUsRUFBRSxDQUFDLFNBQVMsRUFBRSxhQUFhLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSw0Q0FBNEMsRUFBRTtJQUNyRyxFQUFFLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFO0NBQ3BCLENBQUMsQ0FBQyJ9