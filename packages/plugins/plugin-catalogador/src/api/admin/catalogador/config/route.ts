import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import {
  getCatalogadorConfig,
  upsertCatalogadorConfig,
  type CatalogadorConfig,
} from '../../../../modules/catalogador/config';

import { siteOf } from '../_shared';

/**
 * Rangos de `image_technical`, en el ÚNICO lugar que puede hacerlos cumplir.
 *
 * Los clamps de `ai/images.ts` corren al CONSUMIR, no al escribir, así que hasta
 * ahora la UI podía mostrar `webp_quality: 10` mientras sharp usaba 40 — y un
 * `<Input type="number">` vacío persistía `max_dimension: 0`, que hace explotar
 * `sharp.resize({ width: 0 })` y termina como un warning por imagen, en silencio.
 * Rechazar acá con un 400 es lo honesto: el operador ve qué campo está mal en vez
 * de que se le corrija a la espalda.
 */
const IMAGE_TECHNICAL_BOUNDS = {
  // Mismo rango que el clamp de `optimizeToWebp`/`normalizeSquareWebp`.
  webp_quality: { min: 40, max: 95, int: true },
  // 0 haría que el loop de compresión corra siempre hasta el piso de calidad.
  max_kb: { min: 1, max: 20000, int: true },
  // 0 rompe sharp. El techo es holgado a propósito: acota el disparate, no el uso.
  max_dimension: { min: 16, max: 8000, int: true },
  // 0 es válido y significa "no exigir resolución mínima".
  min_dimension: { min: 0, max: 8000, int: true },
} as const;

/**
 * Body de `POST /admin/catalogador/config`.
 *
 * Deliberadamente un `record` con `superRefine` y NO un `z.object({...})`: un
 * schema de objeto DESCARTA las claves que no modela, así que uno incompleto
 * borraría secciones enteras de la config en cada guardado (la UI manda el objeto
 * completo). Esta forma valida lo que importa sin poder perder nada.
 */
export const CatalogadorConfigSchema = z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
  const section = (value as Record<string, unknown>).image_technical;
  if (section === undefined || section === null) return;
  if (typeof section !== 'object' || Array.isArray(section)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['image_technical'],
      message: 'image_technical debe ser un objeto.',
    });
    return;
  }

  for (const [field, bounds] of Object.entries(IMAGE_TECHNICAL_BOUNDS)) {
    const raw = (section as Record<string, unknown>)[field];
    if (raw === undefined || raw === null) continue;
    const path = ['image_technical', field];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${field} debe ser un número.` });
      continue;
    }
    if (bounds.int && !Number.isInteger(raw)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${field} debe ser un entero.` });
      continue;
    }
    if (raw < bounds.min || raw > bounds.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: `${field} debe estar entre ${bounds.min} y ${bounds.max} (recibido ${raw}).`,
      });
    }
  }

  const keepOriginals = (section as Record<string, unknown>).keep_originals;
  if (keepOriginals !== undefined && keepOriginals !== null && typeof keepOriginals !== 'boolean') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['image_technical', 'keep_originals'],
      message: 'keep_originals debe ser un booleano.',
    });
  }
});

/** GET /admin/catalogador/config — config efectiva (sin secretos). */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const config = await getCatalogadorConfig(req.scope, await siteOf(req));
  res.status(200).json({ config });
}

/**
 * POST /admin/catalogador/config — persiste config (merge parcial). Los secretos
 * (API keys de barcode/scraping) NO se aceptan acá: viven en env (PRD §22.4).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `validatedBody` y NO `req.body`: hasta ahora esta ruta era la única del
  // Catalogador sin middleware de validación, y persistía cualquier número.
  const patch = (req.validatedBody ?? {}) as Partial<CatalogadorConfig>;
  const config = await upsertCatalogadorConfig(req.scope, patch, await siteOf(req));
  res.status(200).json({ config });
}
