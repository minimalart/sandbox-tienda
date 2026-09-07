import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { assertProductInSite } from '../../_product-scope';
import { applyCorrections, type CorrectionGap } from '../../../../../modules/seo-geo/ai/corrections';

export const ApplyCorrectionSchema = z.object({
  product_id: z.string().min(1),
  approved: z.record(z.string(), z.unknown()),
});

type ApplyInput = z.infer<typeof ApplyCorrectionSchema>;

/**
 * POST /admin/seo-geo/corrections/apply — aplica las propuestas APROBADas por el
 * usuario a un producto (PRD §15). Conservador: nunca borra contenido existente.
 */
export async function POST(req: MedusaRequest<ApplyInput>, res: MedusaResponse): Promise<void> {
  const { product_id, approved } = req.validatedBody as ApplyInput;
  // Ésta es la que ESCRIBE: `applyCorrections` pisa título, subtítulo y descripción
  // del producto. Sin el guard, un id ajeno bastaba para editar el catálogo de otra
  // tienda desde la pantalla propia, sin dejar rastro de que fue desde acá.
  await assertProductInSite(req, product_id);
  await applyCorrections(req.scope, product_id, approved as Partial<Record<CorrectionGap, unknown>>);
  res.status(200).json({ ok: true });
}
