import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { PDF_CATALOG_MODULE } from '../../modules/pdf-catalog';
import PdfCatalogModuleService, { HotspotInput } from '../../modules/pdf-catalog/service';

export type CreatePdfCatalogStepInput = {
  name: string;
  pdf_url: string;
  pdf_file_id?: string | null;
  pages?: number;
  published?: boolean;
  metadata?: Record<string, unknown> | null;
  hotspots?: HotspotInput[];
  sales_channel_ids?: string[];
};

export const createPdfCatalogStep = createStep(
  'create-pdf-catalog-step',
  async (input: CreatePdfCatalogStepInput, { container }) => {
    const service: PdfCatalogModuleService = container.resolve(PDF_CATALOG_MODULE);

    const { hotspots, sales_channel_ids, ...catalogData } = input;

    const catalog = await service.createPdfCatalogs(catalogData as any);

    if (hotspots?.length) {
      await service.replaceHotspots(catalog.id, hotspots);
    }
    if (sales_channel_ids?.length) {
      await service.reconcileChannels(catalog.id, sales_channel_ids);
    }

    const created = await service.retrievePdfCatalog(catalog.id, {
      relations: ['hotspots', 'channels'],
    });

    return new StepResponse(created, catalog.id);
  },
  async (catalogId, { container }) => {
    if (!catalogId) return;
    const service: PdfCatalogModuleService = container.resolve(PDF_CATALOG_MODULE);
    // FK on delete cascade removes hotspots + channels.
    await service.deletePdfCatalogs(catalogId);
  }
);
