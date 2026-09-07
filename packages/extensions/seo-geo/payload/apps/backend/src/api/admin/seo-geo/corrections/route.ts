import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { assertProductInSite } from '../_product-scope';
import { CORRECTION_GAPS, generateCorrections, type CorrectionGap } from '../../../../modules/seo-geo/ai/corrections';

export const GenerateCorrectionSchema = z.object({
  product_id: z.string().min(1),
  gaps: z.array(z.enum(CORRECTION_GAPS)).optional(),
});

type GenerateInput = z.infer<typeof GenerateCorrectionSchema>;

/**
 * POST /admin/seo-geo/corrections — genera propuestas de contenido con IA para
 * cerrar gaps GEO de un producto (PRD §15). No escribe: devuelve propuestas para
 * aprobación (el apply está en /corrections/apply).
 */
export async function POST(req: MedusaRequest<GenerateInput>, res: MedusaResponse): Promise<void> {
  const { product_id, gaps } = req.validatedBody as GenerateInput;
  await assertProductInSite(req, product_id);
  const result = await generateCorrections(req.scope, product_id, (gaps ?? []) as CorrectionGap[]);
  res.status(200).json(result);
}
