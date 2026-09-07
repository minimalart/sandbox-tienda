import { NextResponse, type NextRequest } from 'next/server';
import type { SdkClientLike } from '../../../../data/recommendations';

/**
 * POST /api/store/recommendations/events — reenvía los eventos al motor.
 *
 * Este proxy existe por una razón concreta: `navigator.sendBeacon` NO puede setear
 * headers, así que pegándole directo al backend se perdería la publishable key y el
 * JWT del cliente. Pasando por nuestro propio origen, las cookies viajan solas y el
 * handler agrega las credenciales — o sea que un beacon disparado durante la descarga
 * de la página igual produce atribución autenticada.
 *
 * Responde 204 siempre. Los beacons reintentan ante error: un 4xx/5xx generaría un
 * loop de reintentos por cada evento inválido, y la validación real (integridad del
 * `request_id`) ya la hace el backend.
 *
 * El plugin NO exporta un `POST` fijo: SDK y cookies son host-coupled. El host arma un
 * shim que llama a `createRecommendationsEventsRoute(deps)` y re-exporta el `POST`.
 */

export interface EventsRouteDeps {
  sdk: SdkClientLike;
  cookies: {
    getAuthHeaders(): Promise<Record<string, string>>;
  };
}

export const createRecommendationsEventsRoute = (
  deps: EventsRouteDeps,
): { POST: (request: NextRequest) => Promise<NextResponse> } => {
  const POST = async (request: NextRequest): Promise<NextResponse> => {
    try {
      const body = await request.json();

      if (!body?.request_id || !Array.isArray(body?.events) || !body.events.length) {
        return new NextResponse(null, { status: 204 });
      }

      const authHeaders = await deps.cookies.getAuthHeaders();

      await deps.sdk.client.fetch('/store/recommendations/events', {
        method: 'POST',
        body: { request_id: body.request_id, events: body.events },
        headers: { ...authHeaders },
        cache: 'no-store',
      });
    } catch (error) {
      console.error('[API] recommendations/events:', error);
    }

    return new NextResponse(null, { status: 204 });
  };

  return { POST };
};
