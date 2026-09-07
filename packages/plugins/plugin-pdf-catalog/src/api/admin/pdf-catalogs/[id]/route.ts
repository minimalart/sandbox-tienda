import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { PDF_CATALOG_MODULE } from '../../../../modules/pdf-catalog';
import PdfCatalogModuleService from '../../../../modules/pdf-catalog/service';
import { HotspotSchema } from '../route';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertRowInSite } from '../../../../lib/multistore/scope';
import { PDF_CATALOG_ROW_SCOPE } from '../../../../modules/pdf-catalog/site-scope';

export const UpdatePdfCatalogSchema = z.object({
  name: z.string().min(1).optional(),
  pdf_url: z.string().min(1).optional(),
  pdf_file_id: z.string().nullable().optional(),
  pages: z.number().int().min(0).optional(),
  published: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  // Cuando se envía `hotspots`, REEMPLAZA toda la lista del catálogo.
  hotspots: z.array(HotspotSchema).optional(),
  // Cuando se envía `sales_channel_ids`, reconcilia en qué canales es el activo.
  sales_channel_ids: z.array(z.string()).optional(),
});

type UpdatePdfCatalogInput = z.infer<typeof UpdatePdfCatalogSchema>;

async function retrieveWithChannels(service: PdfCatalogModuleService, id: string) {
  const catalog = await service.retrievePdfCatalog(id, {
    relations: ['hotspots', 'channels'],
  });
  const sales_channel_ids = ((catalog as any).channels ?? []).map(
    (ch: any) => ch.sales_channel_id
  );
  return { ...(catalog as any), sales_channel_ids };
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id as string;
  const service: PdfCatalogModuleService = req.scope.resolve(PDF_CATALOG_MODULE);

  const pdf_catalog = await retrieveWithChannels(service, id);
  assertRowInSite(pdf_catalog, await siteFromRequest(req), PDF_CATALOG_ROW_SCOPE);
  res.status(200).json({ pdf_catalog });
}

export async function POST(
  req: MedusaRequest<UpdatePdfCatalogInput>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params.id as string;
  const input = req.validatedBody as UpdatePdfCatalogInput;
  const service: PdfCatalogModuleService = req.scope.resolve(PDF_CATALOG_MODULE);

  // Guard antes de mutar: sin esto se puede editar el catálogo de otra tienda
  // conociendo el id, aunque el listado no lo muestre.
  assertRowInSite(await retrieveWithChannels(service, id), await siteFromRequest(req), PDF_CATALOG_ROW_SCOPE);

  const { hotspots, sales_channel_ids, ...catalogData } = input;

  if (Object.keys(catalogData).length) {
    await service.updatePdfCatalogs({ id, ...catalogData } as any);
  }
  if (hotspots !== undefined) {
    await service.replaceHotspots(id, hotspots as any);
  }
  if (sales_channel_ids !== undefined) {
    await service.reconcileChannels(id, sales_channel_ids);
  }

  const pdf_catalog = await retrieveWithChannels(service, id);
  res.status(200).json({ pdf_catalog });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id as string;
  const service: PdfCatalogModuleService = req.scope.resolve(PDF_CATALOG_MODULE);

  assertRowInSite(await retrieveWithChannels(service, id), await siteFromRequest(req), PDF_CATALOG_ROW_SCOPE);

  await service.deletePdfCatalogs(id);

  res.status(200).json({ id, deleted: true });
}
