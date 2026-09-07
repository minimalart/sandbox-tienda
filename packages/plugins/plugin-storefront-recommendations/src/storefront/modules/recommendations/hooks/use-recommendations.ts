'use client';

import { useEffect, useRef, useState } from 'react';
import {
  emptyRecommendationResponse,
  type RecommendationContext,
  type RecommendationPlacement,
  type RecommendationResponse,
} from '../types';

/**
 * Pide recomendaciones desde el CLIENTE (carrito y drawer).
 *
 * El carrito es autoritativamente client-side —`useCartStore` es la fuente de verdad y
 * el drawer nunca re-renderiza desde el servidor— así que estos rails no pueden ser
 * server components como los del PDP.
 *
 * Tres cosas que evita:
 *
 *  - `AbortController` cancela la petición en vuelo cuando cambian las dependencias:
 *    sin eso, tocar `+`/`−` rápido deja respuestas viejas llegando después de las
 *    nuevas y el rail parpadea con datos obsoletos.
 *  - `debounceMs` agrupa las ráfagas del stepper de cantidad.
 *  - `skip` corta antes de armar el request, para no pedir con el carrito vacío.
 */
export function useRecommendations({
  placement,
  cartId,
  productId,
  limit,
  context,
  countryCode,
  skip = false,
  debounceMs = 0,
}: {
  placement: RecommendationPlacement;
  cartId?: string | null;
  productId?: string | null;
  limit?: number;
  context?: RecommendationContext;
  countryCode: string;
  skip?: boolean;
  debounceMs?: number;
}): { data: RecommendationResponse; isLoading: boolean } {
  const [data, setData] = useState<RecommendationResponse>(() =>
    emptyRecommendationResponse(placement),
  );
  const [isLoading, setIsLoading] = useState(false);

  // El contexto se serializa para usarlo como dependencia estable: un objeto nuevo en
  // cada render dispararía un fetch por render.
  const contextKey = context ? JSON.stringify(context) : '';
  const latestRequest = useRef(0);

  useEffect(() => {
    if (skip) {
      setData(emptyRecommendationResponse(placement));
      return;
    }

    const controller = new AbortController();
    const requestId = ++latestRequest.current;

    const run = () => {
      setIsLoading(true);
      const params = new URLSearchParams({ placement, country_code: countryCode });
      if (cartId) params.set('cart_id', cartId);
      if (productId) params.set('product_id', productId);
      if (limit) params.set('limit', String(limit));
      if (contextKey) params.set('context', contextKey);

      fetch(`/api/store/recommendations?${params.toString()}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: RecommendationResponse | null) => {
          // Descartar respuestas de peticiones superadas.
          if (requestId !== latestRequest.current) return;
          setData(payload ?? emptyRecommendationResponse(placement));
          setIsLoading(false);
        })
        .catch(() => {
          if (requestId !== latestRequest.current) return;
          setIsLoading(false);
        });
    };

    const timer = debounceMs > 0 ? setTimeout(run, debounceMs) : null;
    if (!timer) run();

    return () => {
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [placement, cartId, productId, limit, contextKey, countryCode, skip, debounceMs]);

  return { data, isLoading };
}
