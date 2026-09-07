import 'server-only'

import { sdk } from '@lib/config'
import { getAuthHeaders } from '@lib/data/cookies'
import { createRecommendationsEventsRoute } from '@minimalart/mercatto-plugin-storefront-recommendations/storefront/api/store/recommendations/events'

/**
 * Shim del host que delega en la factory publicada por
 * `@minimalart/mercatto-plugin-storefront-recommendations`. La factory de events
 * solo requiere `getAuthHeaders` del CookiesPort — sin cartId ni salesChannelId.
 */
export const { POST } = createRecommendationsEventsRoute({
  sdk: sdk as unknown as Parameters<typeof createRecommendationsEventsRoute>[0]['sdk'],
  cookies: {
    getAuthHeaders: async () => {
      const headers = await getAuthHeaders()
      return (headers ?? {}) as Record<string, string>
    },
  },
})
