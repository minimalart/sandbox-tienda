import { cookies as nextCookies } from 'next/headers'
import { getPrivacyConfiguration } from '../data/privacy'

/**
 * Lee el GA client_id de la cookie `_ga` (server-side) para puentearlo al
 * metadata del cart. El plugin de backend (@variablevic/google-analytics-medusa)
 * lo lee desde `cart.metadata.ga_client_id` para atribuir los eventos
 * server-side (add_to_cart, purchase, etc.) a la sesión/usuario correctos en
 * GA4. Sin esto, esos eventos llegan a GA4 sin atribución.
 *
 * Formato de la cookie `_ga`: `GA1.1.<client_id>` donde client_id son los dos
 * últimos segmentos, ej. `GA1.1.1234567890.1700000000` -> `1234567890.1700000000`.
 * Devuelve null si GA no cargó todavía (cookie ausente) o el formato no calza.
 */
export async function getGaClientId(): Promise<string | null> {
  const config = await getPrivacyConfiguration()
  // Browser permission remains local to the consent engine in this release.
  // Do not create persistent attribution for later, unattributed server events.
  if (!config.available || !config.analytics?.enabled || (config.consent?.enabled && config.consent.mode !== 'informational')) return null
  const cookies = await nextCookies()
  const rawGaCookie = cookies.get('_ga')?.value

  if (!rawGaCookie) {
    return null
  }

  const parts = rawGaCookie.split('.')
  if (parts.length < 4) {
    return null
  }

  return parts.slice(-2).join('.')
}
