import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { siteFromRequest } from '../../../../lib/multistore/request';
import {
  BRIDGE_PLACEMENT,
  RECENTLY_VIEWED_PLACEMENT,
  resolveRecommendations,
} from '../../../../modules/recommendations/serve/resolve';
import { loadProductCards, resolvePriceRegion, type ProductCard } from '../helpers';
import type { PreviewRecommendationsInput } from '../validators';

/**
 * POST /admin/recommendations/preview — qué productos devolvería un placement HOY.
 *
 * Llama a `resolveRecommendations`, la MISMA función que sirve al storefront, así que
 * lo que se ve acá es el comportamiento real y no una simulación: si la cadena cae a
 * un fallback o los filtros dejan cero, eso es exactamente lo que va a ver el
 * comprador.
 *
 * Dos diferencias deliberadas con la ruta store:
 *
 * 1. NO llama a `recordServed`. Esa fila alimenta las impresiones y el CTR de la
 *    pestaña Rendimiento; previsualizar veinte veces inflaría el denominador y
 *    dejaría las métricas inservibles.
 * 2. Devuelve `debug` siempre (la ruta store lo esconde detrás de una env), porque
 *    "por qué esto vino vacío" es justo la pregunta que el preview tiene que
 *    contestar.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const body = req.validatedBody as PreviewRecommendationsInput;
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const isBridge = body.placement === BRIDGE_PLACEMENT;
    const isRecentlyViewed = body.placement === RECENTLY_VIEWED_PLACEMENT;

    // "Vistos recientemente" no consulta relaciones: los candidatos los manda el
    // cliente. Pasar el producto elegido como ORIGEN lo haría descartar por el filtro
    // `source`, así que va como candidato.
    const productId = isRecentlyViewed ? null : (body.product_id ?? null);

    // La banda es la misma que arma el carrito (`cart-slots`): asimétrica, porque algo
    // más caro que el faltante igual cruza el umbral y algo mucho más barato no.
    const targetPrice = isBridge ? (body.target_price ?? 0) : 0;

    // La región se resuelve ANTES de invocar al motor: sin `region_id` explícito el
    // serve cae a la moneda por defecto del boilerplate y los precios del preview no
    // serían los de la tienda. `resolvePriceRegion` ya busca la región default.
    const price = await resolvePriceRegion(req, body.region_id);

    /**
     * El canal con el que se previsualiza. El explícito del body gana —misma
     * precedencia que `siteChannelFilter`, que es la que usan las tres rutas
     * hermanas de este grupo—; si no viene, el primario de la tienda activa.
     *
     * Sin esto la promesa que este archivo hace arriba —"lo que se ve acá es el
     * comportamiento real y no una simulación"— era falsa en cuanto había más de
     * una tienda: `sales_channel_id: null` hace que el motor resuelva la cadena
     * GLOBAL, así que el merchant previsualizaba un placement que no es el que su
     * comprador va a ver, y ajustaba la configuración contra ese resultado.
     */
    const resolution = await siteFromRequest(req);
    const previewChannelId =
      body.sales_channel_id ??
      (resolution.status === 'site' ? (resolution.site.channel_ids[0] ?? null) : null);

    const result = await resolveRecommendations(req.scope, {
      placement: body.placement,
      product_id: productId,
      sales_channel_id: previewChannelId,
      region_id: price.region_id,
      // Sin `limit`: el preview tiene que mostrar el `result_limit` del placement, que
      // es lo que el merchant acaba de configurar.
      limit: null,
      context: {
        ...(targetPrice > 0
          ? {
              target_price: targetPrice,
              price_min: Math.round(targetPrice * 0.75),
              price_max: Math.round(targetPrice * 1.5),
            }
          : {}),
        ...(isRecentlyViewed && body.product_id ? { product_ids: [body.product_id] } : {}),
      },
    });

    // Las cards del backoffice se arman con `loadProductCards` y no con la proyección
    // del motor: así el preview muestra las MISMAS tarjetas que Relaciones (con estado
    // y stock), en lugar de una segunda variante de "producto" que haya que mantener.
    const cards = await loadProductCards(
      req,
      result.products.map((product) => product.product_id),
      price,
    );

    const products = result.products
      .map((product) => cards.get(product.product_id))
      .filter((card): card is ProductCard => Boolean(card));

    res.status(200).json({
      placement: result.placement,
      strategy_key: result.strategy_key,
      resolved_strategy_key: result.resolved_strategy_key,
      fallback_used: result.fallback_used,
      fallback_chain: result.fallback_chain,
      limit: result.limit,
      count: result.count,
      products,
      debug: result.debug ?? null,
    });
  } catch (error) {
    // El preview es una herramienta de diagnóstico: si falla, tiene que decir por qué
    // en lugar de romper la pantalla de configuración.
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      `[recommendations] fallo al previsualizar el placement "${body.placement}": ${message}`,
    );
    res.status(200).json({
      placement: body.placement,
      strategy_key: null,
      resolved_strategy_key: null,
      fallback_used: false,
      fallback_chain: [],
      limit: 0,
      count: 0,
      products: [],
      debug: null,
      error: message,
    });
  }
}
