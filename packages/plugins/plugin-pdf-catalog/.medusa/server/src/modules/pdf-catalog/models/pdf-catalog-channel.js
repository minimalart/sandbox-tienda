"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfCatalogChannel = void 0;
const utils_1 = require("@medusajs/framework/utils");
const pdf_catalog_1 = require("./pdf-catalog");
/**
 * PdfCatalogChannel — activación de un catálogo en un sales channel.
 *
 * Invariante del feature: "una sola activa por sales channel". Se garantiza con
 * un índice UNIQUE parcial sobre `sales_channel_id` (ver migración): activar un
 * catálogo en un canal ya ocupado "roba" el canal (reconciliación en el
 * workflow), y la DB impide dos filas vivas para el mismo canal.
 */
exports.PdfCatalogChannel = utils_1.model
    .define('pdf_catalog_channel', {
    id: utils_1.model
        .id({
        prefix: 'pcch',
    })
        .primaryKey(),
    sales_channel_id: utils_1.model.text(),
    catalog: utils_1.model.belongsTo(() => pdf_catalog_1.PdfCatalog, {
        mappedBy: 'channels',
    }),
})
    .indexes([
    {
        on: ['sales_channel_id'],
        unique: true,
        where: 'deleted_at IS NULL',
    },
    {
        on: ['catalog_id'],
        where: 'deleted_at IS NULL',
    },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGRmLWNhdGFsb2ctY2hhbm5lbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3BkZi1jYXRhbG9nL21vZGVscy9wZGYtY2F0YWxvZy1jaGFubmVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUNsRCwrQ0FBMkM7QUFFM0M7Ozs7Ozs7R0FPRztBQUNVLFFBQUEsaUJBQWlCLEdBQUcsYUFBSztLQUNuQyxNQUFNLENBQUMscUJBQXFCLEVBQUU7SUFDN0IsRUFBRSxFQUFFLGFBQUs7U0FDTixFQUFFLENBQUM7UUFDRixNQUFNLEVBQUUsTUFBTTtLQUNmLENBQUM7U0FDRCxVQUFVLEVBQUU7SUFDZixnQkFBZ0IsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQzlCLE9BQU8sRUFBRSxhQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLHdCQUFVLEVBQUU7UUFDekMsUUFBUSxFQUFFLFVBQVU7S0FDckIsQ0FBQztDQUNILENBQUM7S0FDRCxPQUFPLENBQUM7SUFDUDtRQUNFLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDO1FBQ3hCLE1BQU0sRUFBRSxJQUFJO1FBQ1osS0FBSyxFQUFFLG9CQUFvQjtLQUM1QjtJQUNEO1FBQ0UsRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDO1FBQ2xCLEtBQUssRUFBRSxvQkFBb0I7S0FDNUI7Q0FDRixDQUFDLENBQUMifQ==