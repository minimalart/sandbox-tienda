import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { productIdsForSite } from '../../../../lib/multistore/product-scope';
import { getSeoGeoConfig } from '../../../../modules/seo-geo/config';
import { runSimulator } from '../../../../modules/seo-geo/ai/simulator';
import { embedCatalog } from '../../../../modules/seo-geo/ai/embed-catalog';

export const SimulatorSchema = z.object({
  prompt: z.string().min(3, 'Escribí una consulta'),
});

type SimulatorInput = z.infer<typeof SimulatorSchema>;

/**
 * POST /admin/seo-geo/simulator — ejecuta el Simulador IA (PRD §12): recupera
 * productos del catálogo por similitud y responde con el LLM, explicando cuáles
 * usó y cuáles no. `?embed=1` fuerza un embed incremental previo.
 */
export async function POST(req: MedusaRequest<SimulatorInput>, res: MedusaResponse): Promise<void> {
  const { prompt } = req.validatedBody as SimulatorInput;

  // Las TRES mitades del simulador tienen eje de tienda, y hasta acá ninguna lo
  // aplicaba: la config (top_k, umbral, modelo) es por tienda desde
  // `admin/seo-geo/config`; el embed recorría el catálogo entero; y la
  // recuperación rankeaba sobre los embeddings de TODA la instalación. La última
  // era la cara: el operador escribía "¿tenés pintura para exterior?" y el
  // simulador le contestaba con productos que su tienda no vende, con id y todo.
  const resolution = await siteFromRequest(req);
  const siteId = resolution.status === 'site' ? resolution.site.id : null;
  const cfg = await getSeoGeoConfig(req.scope, siteId);

  if (req.query.embed === '1') {
    await embedCatalog(req.scope, {
      // Un canal y no la lista: `loadGeoProducts` toma uno solo. El primario de la
      // tienda es el que el resto de las rutas del repo usa cuando hay que elegir
      // uno (`commerce-dashboard`, `siteDefaults` de `channel_column`).
      salesChannelId: resolution.status === 'site' ? (resolution.site.channel_ids[0] ?? null) : null,
      max: cfg.crawl.max_pages * 20,
      limit: 200,
    }).catch(() => undefined);
  }

  const result = await runSimulator(req.scope, prompt, cfg, {
    allowedProductIds: await productIdsForSite(req),
  });
  res.status(200).json(result);
}
