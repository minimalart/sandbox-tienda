import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ERP_MODULE } from '../../../../modules/erp';
import type ErpModuleService from '../../../../modules/erp/service';
import { resolveTintingReadiness } from '../../../../modules/erp/tinting/readiness';
import type { ErpConfigSettings } from '../../../../modules/erp/types';

/**
 * GET /store/tinting/catalog?collection=... — la carta completa, para el flujo
 * inverso (elegir color primero y recién después la base).
 *
 * Ruta separada de `/store/tinting/colors` a propósito: aquella responde "qué
 * colores acepta ESTA base" y exige `variant_id`; acá todavía no hay variante
 * elegida. Mezclarlas obligaría a que el mismo endpoint devuelva dos cosas
 * distintas según qué parámetros vengan.
 *
 * Devuelve DOS banderas porque son dos cosas distintas, y confundirlas costó un
 * 404 en producción:
 *
 *  - `enabled`: el switch `tinting.enabled` del ERP. Es la fuente de verdad del
 *    gate de datos, así que el storefront no necesita una variable de entorno
 *    paralela que se desincronice.
 *  - `ready`: además hay carta importada Y al menos una base que se puede
 *    comprar. Una instancia con el switch prendido y CERO colores respondía
 *    `enabled: true` con `colors: []`, o sea decía "prendido" y no había nada que
 *    mostrar; el storefront lo leía como feature apagada y hacía `notFound()` sin
 *    una línea de log. Es el mismo dato que `readiness.ready` de
 *    `/admin/erp/tinting`, que el admin ya mostraba.
 *
 * La condición de base vendible NO estaba y costó una sección rota en producción:
 * con 2848 colores y 117 bases confirmadas de las que ninguna existía como
 * producto, "Buscá tu color" ofrecía la carta entera y CADA color terminaba en
 * "por ahora no tenemos productos en esta tienda". Un empty state honesto es
 * mejor que una carta que no lleva a ninguna parte, y se prende sola en cuanto
 * las bases entran (`POST /admin/erp/tinting/bases/sync-products`).
 *
 * La cuenta de vendibles es de instancia y no por canal: este endpoint se cachea
 * público 5 minutos y hacerlo depender del canal lo volvería incacheable para
 * responder una pregunta distinta de la que hace ("¿hay con qué entonar acá?").
 *
 * Nunca devuelve el código de fórmula, por lo mismo que `colors`: es el único
 * parámetro que decide qué cotiza el ERP.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const config = await service.getActiveConfig().catch(() => null);
  const settings = (config?.settings ?? {}) as ErpConfigSettings;

  if (!settings.tinting?.enabled) {
    res.json({ enabled: false, ready: false, collections: [], colors: [] });
    return;
  }

  const collection = String(req.query.collection ?? '').trim() || null;

  try {
    const colors = await service.listTintingCatalogColors(collection);
    const collections = [...new Set(colors.map((color) => color.collection))].sort();

    // Sin colores no hace falta ni preguntar por las bases: ya sabemos que no
    // está lista, y así el caso "carta vacía" no paga una consulta de más.
    const basesSellable = colors.length
      ? (await resolveTintingReadiness(req.scope, service)).bases_sellable
      : 0;

    // La carta cambia cuando alguien importa colores, no por pedido.
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.json({
      enabled: true,
      ready: colors.length > 0 && basesSellable > 0,
      collections,
      colors: colors.map((color) => ({
        code: color.code,
        name: color.name,
        collection: color.collection,
        family: color.family,
        hex: color.hex,
      })),
    });
  } catch (error) {
    // Misma doctrina que el resto de /store/tinting: sin carta la página muestra
    // su empty state, no un error.
    console.error('[tinting] catalog error:', error instanceof Error ? error.stack : error);
    res.json({ enabled: false, ready: false, collections: [], colors: [] });
  }
}
