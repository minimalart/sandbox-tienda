import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { z } from 'zod';
import { resolveB2BLines } from '../resolve-lines';

const Body = z.object({
  lines: z
    .array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() }))
    .min(1),
});

/** Import por CSV / pegado de Excel: resuelve líneas SKU+cantidad (mismo resolver). */
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
