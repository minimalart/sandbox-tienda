import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { getSeoGeoConfig, upsertSeoGeoConfig, type SeoGeoConfig } from '../../../../modules/seo-geo/config';

import { siteFromRequest } from '../../../../lib/multistore/request';


/** `null` = la fila GLOBAL, que es el fallback de toda tienda sin config propia. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

/** Patch parcial de la config (todas las secciones opcionales). */
export const UpdateConfigSchema = z.object({
  crawl: z.record(z.string(), z.unknown()).optional(),
  engines: z.record(z.string(), z.unknown()).optional(),
  technical: z.record(z.string(), z.unknown()).optional(),
  geo_weights: z.record(z.string(), z.unknown()).optional(),
  geo_thresholds: z.record(z.string(), z.unknown()).optional(),
  simulator: z.record(z.string(), z.unknown()).optional(),
  automation: z.record(z.string(), z.unknown()).optional(),
  // Sin esta línea zod BORRA la sección al validar —los objetos de zod strippean lo
  // que no declaran— y el formulario guardaría en silencio todo menos el Open Graph.
  open_graph: z.record(z.string(), z.unknown()).optional(),
});

type UpdateConfigInput = z.infer<typeof UpdateConfigSchema>;

/** GET /admin/seo-geo/config — config efectiva (merge sobre defaults). */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const config = await getSeoGeoConfig(req.scope, await siteOf(req));
  res.status(200).json({ config });
}

/** POST /admin/seo-geo/config — persiste un patch parcial y devuelve el resultado. */
export async function POST(req: MedusaRequest<UpdateConfigInput>, res: MedusaResponse): Promise<void> {
  const patch = req.validatedBody as Partial<SeoGeoConfig>;
  const config = await upsertSeoGeoConfig(req.scope, patch, await siteOf(req));
  res.status(200).json({ config });
}
