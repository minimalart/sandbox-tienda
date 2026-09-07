import { NextResponse, type NextRequest } from 'next/server';
import { emptyRecommendationResponse } from '../../../modules/recommendations/types';
import type { SdkClientLike } from '../../../data/recommendations';

/**
 * GET /api/store/recommendations — BFF para los rails que se renderizan en cliente
 * (carrito, drawer, bridge products).
 *
 * El contexto de demo se resuelve DENTRO del handler: el proxy saltea `/api` para el
 * rewrite pero reinyecta `x-demo-slug` desde la cookie `_demo_slug`, y
 * `getActiveSalesChannelId()` lo usa. Sin esto, un demo buscaría recomendaciones en el
 * catálogo del store principal (precedente: `app/api/search-data/route.ts`).
 *
 * El `session_id` SIEMPRE se toma de la cookie y nunca del query: si se aceptara del
 * cliente, cualquiera podría escribir eventos en la sesión de otro.
 *
 * El plugin NO exporta un `GET` fijo: SDK, cookies y `getRegion` son host-coupled. El
 * host arma un shim de una línea que llama a `createGetRecommendationsRoute(deps)` y
 * re-exporta el `GET` devuelto.
 */

const SESSION_COOKIE = '_rec_sid';
const MAX_CONTEXT_CHARS = 2048;

export interface RecommendationsRouteDeps {
  sdk: SdkClientLike;
  cookies: {
    getActiveSalesChannelId(): Promise<string | null>;
    getAuthHeaders(): Promise<Record<string, string>>;
    getCartId(): Promise<string | null>;
  };
  getRegion: (countryCode: string) => Promise<{ id?: string | null } | null>;
}

export const createGetRecommendationsRoute = (
  deps: RecommendationsRouteDeps,
): { GET: (request: NextRequest) => Promise<NextResponse> } => {
  const GET = async (request: NextRequest): Promise<NextResponse> => {
    const params = request.nextUrl.searchParams;
    const placement = params.get('placement');

    if (!placement) {
      return NextResponse.json({ message: 'placement is required' }, { status: 400 });
    }

    try {
      const rawContext = params.get('context');
      // Tope de tamaño: este payload viaja a una query de candidatos y a un batch de
      // hidratación. Un `product_ids` gigante sería un vector de abuso barato.
      if (rawContext && rawContext.length > MAX_CONTEXT_CHARS) {
        return NextResponse.json(emptyRecommendationResponse(placement));
      }

      let context: unknown;
      if (rawContext) {
        try {
          context = JSON.parse(rawContext);
        } catch {
          context = undefined;
        }
      }

      const countryCode = params.get('country_code');
      const [salesChannelId, authHeaders, cartIdCookie] = await Promise.all([
        deps.cookies.getActiveSalesChannelId(),
        deps.cookies.getAuthHeaders(),
        deps.cookies.getCartId(),
      ]);
      const region = countryCode ? await deps.getRegion(countryCode) : null;
      const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
      const limit = Number(params.get('limit') ?? '');

      const result = await deps.sdk.client.fetch('/store/recommendations', {
        method: 'POST',
        body: {
          placement,
          ...(params.get('product_id') ? { product_id: params.get('product_id') } : {}),
          ...(params.get('cart_id') || cartIdCookie
            ? { cart_id: params.get('cart_id') || cartIdCookie }
            : {}),
          ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
          ...(region?.id ? { region_id: region.id } : {}),
          ...(sessionId ? { session_id: sessionId } : {}),
          ...(Number.isFinite(limit) && limit > 0 ? { limit } : {}),
          ...(context && typeof context === 'object' ? { context } : {}),
        },
        headers: { ...authHeaders },
        cache: 'no-store',
      });

      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    } catch (error) {
      console.error('[API] recommendations:', error);
      // 200 con lista vacía, nunca 500: el cliente no debe mostrar un error por un rail
      // de recomendaciones que no cargó.
      return NextResponse.json(emptyRecommendationResponse(placement));
    }
  };

  return { GET };
};
