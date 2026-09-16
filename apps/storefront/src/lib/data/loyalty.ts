import 'server-only'

import { sdk } from '@lib/config'
import { getAuthHeaders } from '@lib/data/cookies'

/**
 * Puente del storefront con las rutas de fidelización del backend.
 *
 * Los componentes de `@minimalart/mercatto-plugin-loyalty` pegan a
 * `/api/store/points` y `/api/store/loyalty/*`, que son rutas de ESTA app. El
 * plugin publica handlers propios para esas rutas, pero no se pueden usar acá:
 * leen la cookie `_medusa_jwt`, y este storefront es multitienda — el token del
 * cliente vive en `_mercatto_<modo>_<sitio>_jwt` (ver `sessionCookieName`). Con
 * el handler del plugin la pantalla contesta siempre "No autenticado" aunque la
 * sesión esté abierta.
 *
 * Por eso las rutas las implementa el host y usan `getAuthHeaders()`, que
 * resuelve la cookie de la tienda y el modo activos. Las respuestas conservan
 * la forma que esperan los componentes del plugin.
 */

export type LoyaltyResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string }

export async function loyaltyFetch<T>(
  path: string,
  init?: { method?: 'GET' | 'POST'; body?: Record<string, unknown> },
): Promise<LoyaltyResult<T>> {
  const headers = await getAuthHeaders()
  if (!headers.authorization) {
    return { ok: false, status: 401, message: 'No autenticado' }
  }

  try {
    const data = await sdk.client.fetch<T>(path, {
      method: init?.method ?? 'GET',
      headers: {
        ...headers,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init?.body ? { body: init.body } : {}),
      cache: 'no-store',
    })
    return { ok: true, data }
  } catch (error: unknown) {
    // Sesión vencida: el backend contesta 401 y no es un error de la pantalla.
    const status = (error as { status?: number })?.status
    const message = error instanceof Error ? error.message : 'Error de fidelización'
    return { ok: false, status: status === 401 ? 401 : 400, message }
  }
}
