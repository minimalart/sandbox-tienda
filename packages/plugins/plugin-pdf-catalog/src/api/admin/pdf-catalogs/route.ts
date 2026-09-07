import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { PDF_CATALOG_MODULE } from '../../../modules/pdf-catalog';
import PdfCatalogModuleService from '../../../modules/pdf-catalog/service';
import { createPdfCatalogWorkflow } from '../../../workflows/create-pdf-catalog';
import { siteFromRequest } from '../../../lib/multistore/request';
import { siteFilter } from '../../../lib/multistore/scope';
import { PDF_CATALOG_SITE_SCOPE } from '../../../modules/pdf-catalog/site-scope';

export const HotspotSchema = z.object({
  type: z.enum(['product', 'video', 'text']),
  page_index: z.number().int().min(0).optional().default(0),
  pos_x: z.number().int().min(0).max(100).optional().default(50),
  pos_y: z.number().int().min(0).max(100).optional().default(50),
  product_id: z.string().nullable().optional(),
  variant_id: z.string().nullable().optional(),
  data: z.record(z.string(), z.unknown()).nullable().optional(),
  sort_order: z.number().int().optional().default(0),
});

export const CreatePdfCatalogSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  pdf_url: z.string().min(1, 'PDF is required'),
  pdf_file_id: z.string().nullable().optional(),
  pages: z.number().int().min(0).optional().default(0),
  published: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  hotspots: z.array(HotspotSchema).optional().default([]),
  sales_channel_ids: z.array(z.string()).optional().default([]),
});

type CreatePdfCatalogInput = z.infer<typeof CreatePdfCatalogSchema>;

export async function POST(
  req: MedusaRequest<CreatePdfCatalogInput>,
  res: MedusaResponse
): Promise<void> {
  const input = req.validatedBody as CreatePdfCatalogInput;

  const { result } = await createPdfCatalogWorkflow(req.scope).run({ input });

  const service: PdfCatalogModuleService = req.scope.resolve(PDF_CATALOG_MODULE);
  const sales_channel_ids = await service.getActiveChannelIds(result.id);

  res.status(201).json({ pdf_catalog: { ...result, sales_channel_ids } });
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service: PdfCatalogModuleService = req.scope.resolve(PDF_CATALOG_MODULE);

  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const filters: Record<string, unknown> = {};
  if (q) {
    filters.name = { $ilike: `%${q}%` };
  }

  // join_table: la pertenencia vive en pdf_catalog_channel, no en el catálogo.
  Object.assign(filters, await siteFilter(req.scope, await siteFromRequest(req), PDF_CATALOG_SITE_SCOPE));

  const [catalogs, count] = await service.listAndCountPdfCatalogs(filters, {
    skip: offset,
    take: limit,
    relations: ['hotspots', 'channels'],
    order: { created_at: 'DESC' },
  });

  const pdf_catalogs = catalogs.map((c: Record<string, any>) => ({
    ...c,
    sales_channel_ids: (c.channels ?? []).map((ch: any) => ch.sales_channel_id),
  }));

  res.status(200).json({ pdf_catalogs, count, offset, limit });
}
