import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { z } from 'zod';
import { resolveB2BLines } from '../resolve-lines';

const Body = z.object({
  lines: z
    .array(
      z.object({
        sku: z.string().optional(),
        variant_id: z.string().optional(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

/**
 * Resuelve líneas (SKU/variant + cantidad) a variantes con precio mayorista +
 * stock, para que el storefront las agregue al carrito B2B. Reporta sin stock /
 * inexistentes. (Usado por la tabla de compra rápida y por el pegado de Excel.)
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const result = await resolveB2BLines(req.scope, req.auth_context.actor_id, parsed.data.lines);
  res.json(result);
}
