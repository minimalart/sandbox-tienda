"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPdfCatalogStep = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const pdf_catalog_1 = require("../../modules/pdf-catalog");
exports.createPdfCatalogStep = (0, workflows_sdk_1.createStep)('create-pdf-catalog-step', async (input, { container }) => {
    const service = container.resolve(pdf_catalog_1.PDF_CATALOG_MODULE);
    const { hotspots, sales_channel_ids, ...catalogData } = input;
    const catalog = await service.createPdfCatalogs(catalogData);
    if (hotspots?.length) {
        await service.replaceHotspots(catalog.id, hotspots);
    }
    if (sales_channel_ids?.length) {
        await service.reconcileChannels(catalog.id, sales_channel_ids);
    }
    const created = await service.retrievePdfCatalog(catalog.id, {
        relations: ['hotspots', 'channels'],
    });
    return new workflows_sdk_1.StepResponse(created, catalog.id);
}, async (catalogId, { container }) => {
    if (!catalogId)
        return;
    const service = container.resolve(pdf_catalog_1.PDF_CATALOG_MODULE);
    // FK on delete cascade removes hotspots + channels.
    await service.deletePdfCatalogs(catalogId);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLXBkZi1jYXRhbG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3dvcmtmbG93cy9zdGVwcy9jcmVhdGUtcGRmLWNhdGFsb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUVBQTZFO0FBQzdFLDJEQUErRDtBQWNsRCxRQUFBLG9CQUFvQixHQUFHLElBQUEsMEJBQVUsRUFDNUMseUJBQXlCLEVBQ3pCLEtBQUssRUFBRSxLQUFnQyxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUN4RCxNQUFNLE9BQU8sR0FBNEIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxnQ0FBa0IsQ0FBQyxDQUFDO0lBRS9FLE1BQU0sRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxXQUFXLEVBQUUsR0FBRyxLQUFLLENBQUM7SUFFOUQsTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUMsaUJBQWlCLENBQUMsV0FBa0IsQ0FBQyxDQUFDO0lBRXBFLElBQUksUUFBUSxFQUFFLE1BQU0sRUFBRSxDQUFDO1FBQ3JCLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFDRCxJQUFJLGlCQUFpQixFQUFFLE1BQU0sRUFBRSxDQUFDO1FBQzlCLE1BQU0sT0FBTyxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQsTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRTtRQUMzRCxTQUFTLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDO0tBQ3BDLENBQUMsQ0FBQztJQUVILE9BQU8sSUFBSSw0QkFBWSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDL0MsQ0FBQyxFQUNELEtBQUssRUFBRSxTQUFTLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFO0lBQ2pDLElBQUksQ0FBQyxTQUFTO1FBQUUsT0FBTztJQUN2QixNQUFNLE9BQU8sR0FBNEIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxnQ0FBa0IsQ0FBQyxDQUFDO0lBQy9FLG9EQUFvRDtJQUNwRCxNQUFNLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUM3QyxDQUFDLENBQ0YsQ0FBQyJ9