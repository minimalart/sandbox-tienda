"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
class PdfCatalogModuleService extends (0, utils_1.MedusaService)({
    PdfCatalog: models_1.PdfCatalog,
    PdfCatalogHotspot: models_1.PdfCatalogHotspot,
    PdfCatalogChannel: models_1.PdfCatalogChannel,
}) {
    /**
     * Reemplaza por completo los hotspots de un catálogo por la lista dada.
     * (Igual que shop_by_look: enviar la lista pisa la anterior.)
     */
    async replaceHotspots(catalogId, hotspots) {
        const existing = await this.listPdfCatalogHotspots({ catalog_id: catalogId });
        if (existing.length) {
            await this.deletePdfCatalogHotspots(existing.map((e) => e.id));
        }
        if (hotspots.length) {
            await this.createPdfCatalogHotspots(hotspots.map((h, i) => ({
                type: h.type,
                page_index: h.page_index ?? 0,
                pos_x: h.pos_x ?? 50,
                pos_y: h.pos_y ?? 50,
                product_id: h.product_id ?? null,
                variant_id: h.variant_id ?? null,
                data: (h.data ?? null),
                sort_order: h.sort_order ?? i,
                catalog_id: catalogId,
            })));
        }
    }
    /**
     * Reconcilia en qué sales channels este catálogo es EL activo.
     *
     * Invariante "uno activo por canal": para cada canal deseado que hoy pertenece
     * a otro catálogo, se le "roba" (se borra la fila viva ajena) antes de crear la
     * propia; los canales que dejan de estar en la lista se desactivan. El índice
     * UNIQUE parcial sobre sales_channel_id respalda la invariante a nivel DB.
     */
    async reconcileChannels(catalogId, salesChannelIds) {
        const desired = new Set(salesChannelIds.filter((s) => typeof s === 'string' && s.length > 0));
        const current = await this.listPdfCatalogChannels({ catalog_id: catalogId });
        const currentByChannel = new Map(current.map((c) => [c.sales_channel_id, c]));
        // Desactivar los canales que este catálogo tenía y ya no están en la lista.
        const toRemove = current.filter((c) => !desired.has(c.sales_channel_id));
        if (toRemove.length) {
            await this.deletePdfCatalogChannels(toRemove.map((c) => c.id));
        }
        // Activar los canales nuevos, robándoselos a quien los tuviera.
        for (const sc of desired) {
            if (currentByChannel.has(sc))
                continue; // ya es nuestro
            const held = await this.listPdfCatalogChannels({ sales_channel_id: sc });
            if (held.length) {
                await this.deletePdfCatalogChannels(held.map((h) => h.id));
            }
            await this.createPdfCatalogChannels({ sales_channel_id: sc, catalog_id: catalogId });
        }
    }
    /** Lista de sales_channel_ids donde este catálogo es el activo. */
    async getActiveChannelIds(catalogId) {
        const rows = await this.listPdfCatalogChannels({ catalog_id: catalogId });
        return rows.map((r) => r.sales_channel_id);
    }
}
exports.default = PdfCatalogModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3BkZi1jYXRhbG9nL3NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxxREFBMEQ7QUFDMUQscUNBQTRFO0FBYTVFLE1BQU0sdUJBQXdCLFNBQVEsSUFBQSxxQkFBYSxFQUFDO0lBQ2xELFVBQVUsRUFBVixtQkFBVTtJQUNWLGlCQUFpQixFQUFqQiwwQkFBaUI7SUFDakIsaUJBQWlCLEVBQWpCLDBCQUFpQjtDQUNsQixDQUFDO0lBQ0E7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLGVBQWUsQ0FBQyxTQUFpQixFQUFFLFFBQXdCO1FBQy9ELE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLHNCQUFzQixDQUFDLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFDOUUsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDcEIsTUFBTSxJQUFJLENBQUMsd0JBQXdCLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDakUsQ0FBQztRQUNELElBQUksUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3BCLE1BQU0sSUFBSSxDQUFDLHdCQUF3QixDQUNqQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDdEIsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJO2dCQUNaLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxJQUFJLENBQUM7Z0JBQzdCLEtBQUssRUFBRSxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUU7Z0JBQ3BCLEtBQUssRUFBRSxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUU7Z0JBQ3BCLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxJQUFJ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