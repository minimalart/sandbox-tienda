"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePdfCatalogSchema = void 0;
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const zod_1 = require("zod");
const pdf_catalog_1 = require("../../../../modules/pdf-catalog");
const route_1 = require("../route");
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/pdf-catalog/site-scope");
exports.UpdatePdfCatalogSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    pdf_url: zod_1.z.string().min(1).optional(),
    pdf_file_id: zod_1.z.string().nullable().optional(),
    pages: zod_1.z.number().int().min(0).optional(),
    published: zod_1.z.boolean().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
    // Cuando se envía `hotspots`, REEMPLAZA toda la lista del catálogo.
    hotspots: zod_1.z.array(route_1.HotspotSchema).optional(),
    // Cuando se envía `sales_channel_ids`, reconcilia en qué canales es el activo.
    sales_channel_ids: zod_1.z.array(zod_1.z.string()).optional(),
});
async function retrieveWithChannels(service, id) {
    const catalog = await service.retrievePdfCatalog(id, {
        relations: ['hotspots', 'channels'],
    });
    const sales_channel_ids = (catalog.channels ?? []).map((ch) => ch.sales_channel_id);
    return { ...catalog, sales_channel_ids };
}
async function GET(req, res) {
    const id = req.params.id;
    const service = req.scope.resolve(pdf_catalog_1.PDF_CATALOG_MODULE);
    const pdf_catalog = await retrieveWithChannels(service, id);
    (0, scope_1.assertRowInSite)(pdf_catalog, await (0, request_1.siteFromRequest)(req), site_scope_1.PDF_CATALOG_ROW_SCOPE);
    res.status(200).json({ pdf_catalog });
}
async function POST(req, res) {
    const id = req.params.id;
    const input = req.validatedBody;
    const service = req.scope.resolve(pdf_catalog_1.PDF_CATALOG_MODULE);
    // Guard antes de mutar: sin esto se puede editar el catálogo de otra tienda
    // conociendo el id, aunque el listado no lo muestre.
    (0, scope_1.assertRowInSite)(await retrieveWithChannels(service, id), await (0, request_1.siteFromRequest)(req), site_scope_1.PDF_CATALOG_ROW_SCOPE);
    const { hotspots, sales_channel_ids, ...catalogData } = input;
    if (Object.keys(catalogData).length) {
        await service.updatePdfCatalogs({ id, ...catalogData });
    }
    if (hotspots !== undefined) {
        await service.replaceHotspots(id, hotspots);
    }
    if (sales_channel_ids !== undefined) {
        await service.reconcileChannels(id, sales_channel_ids);
    }
    const pdf_catalog = await retrieveWithChannels(service, id);
    res.status(200).json({ pdf_catalog });
}
async function DELETE(req, res) {
    const id = req.params.id;
    const service = req.scope.resolve(pdf_catalog_1.PDF_CATALOG_MODULE);
    (0, scope_1.assertRowInSite)(await retrieveWithChannels(service, id), await (0, request_1.siteFromRequest)(req), site_scope_1.PDF_CATALOG_ROW_SCOPE);
    await service.deletePdfCatalogs(id);
    res.status(200).json({ id, deleted: true });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3BkZi1jYXRhbG9ncy9baWRdL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQWtDQSxrQkFPQztBQUVELG9CQTBCQztBQUVELHdCQVNDO0FBL0VELDZCQUF3QjtBQUN4QixpRUFBcUU7QUFFckUsb0NBQXlDO0FBQ3pDLGdFQUFxRTtBQUNyRSw0REFBbUU7QUFDbkUsMkVBQW1GO0FBRXRFLFFBQUEsc0JBQXNCLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUM3QyxJQUFJLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUU7SUFDbEMsT0FBTyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFO0lBQ3JDLFdBQVcsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzdDLEtBQUssRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRTtJQUN6QyxTQUFTLEVBQUUsT0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNqQyxRQUFRLEVBQUUsT0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsT0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2pFLG9FQUFvRTtJQUNwRSxRQUFRLEVBQUUsT0FBQyxDQUFDLEtBQUssQ0FBQyxxQkFBYSxDQUFDLENBQUMsUUFBUSxFQUFFO0lBQzNDLCtFQUErRTtJQUMvRSxpQkFBaUIsRUFBRSxPQUFDLENBQUMsS0FB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