"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfCatalog = void 0;
const utils_1 = require("@medusajs/framework/utils");
const pdf_catalog_hotspot_1 = require("./pdf-catalog-hotspot");
const pdf_catalog_channel_1 = require("./pdf-catalog-channel");
/**
 * PdfCatalog — un catálogo/revista en PDF navegable como flipbook, con hotspots
 * interactivos encima (producto / video / texto).
 *
 * Se pueden crear varios, pero por cada sales channel hay a lo sumo UNO activo:
 * la exclusividad vive en `PdfCatalogChannel` (unique por sales_channel_id), no
 * acá. `published` es un gate independiente: un catálogo debe estar publicado Y
 * activo en el canal para verse en el storefront.
 */
exports.PdfCatalog = utils_1.model.define('pdf_catalog', {
    id: utils_1.model
        .id({
        prefix: 'pcat',
    })
        .primaryKey(),
    name: utils_1.model.text(),
    pdf_url: utils_1.model.text(),
    pdf_file_id: utils_1.model.text().nullable(),
    pages: utils_1.model.number().default(0),
    published: utils_1.model.boolean().default(false),
    metadata: utils_1.model.json().nullable(),
    hotspots: utils_1.model.hasMany(() => pdf_catalog_hotspot_1.PdfCatalogHotspot, {
        mappedBy: 'catalog',
    }),
    channels: utils_1.model.hasMany(() => pdf_catalog_channel_1.PdfCatalogChannel, {
        mappedBy: 'catalog',
    }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGRmLWNhdGFsb2cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9wZGYtY2F0YWxvZy9tb2RlbHMvcGRmLWNhdGFsb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBQ2xELCtEQUEwRDtBQUMxRCwrREFBMEQ7QUFFMUQ7Ozs7Ozs7O0dBUUc7QUFDVSxRQUFBLFVBQVUsR0FBRyxhQUFLLENBQUMsTUFBTSxDQUFDLGFBQWEsRUFBRTtJQUNwRCxFQUFFLEVBQUUsYUFBSztTQUNOLEVBQUUsQ0FBQztRQUNGLE1BQU0sRUFBRSxNQUFNO0tBQ2YsQ0FBQztTQUNELFVBQVUsRUFBRTtJQUNmLElBQUksRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ2xCLE9BQU8sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ3JCLFdBQVcsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3BDLEtBQUssRUFBRSxhQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNoQyxTQUFTLEVBQUUsYUFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDekMsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsUUFBUSxFQUFFLGFBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsdUNBQWlCLEVBQUU7UUFDL0MsUUFBUSxFQUFFLFNBQVM7S0FDcEIsQ0FBQztJQUNGLFFBQVEsRUFBRSxhQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLHVDQUFpQixFQUFFO1FBQy9DLFFBQVEsRUFBRSxTQUFTO0tBQ3BCLENBQUM7Q0FDSCxDQUFDLENBQUMifQ==