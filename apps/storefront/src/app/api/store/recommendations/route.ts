import 'server-only'

import { sdk } from '@lib/config'
import { getActiveSalesChannelId, getAuthHeaders, getCartId } from '@lib/data/cookies'
import { getRegion } from '@lib/data/regions'
import { createGetRecommendationsRoute } from '@minimalart/mercatto-plugin-storefront-recommendations/storefront/api/store/recommendations'

/**
 * Shim del host que delega en la factory publicada por
 * `@minimalart/mercatto-plugin-storefront-recommendations`. Los cookies helpers
 * del host devuelven `string | undefined`; el port declara `string | null`, asi
 * que normalizamos en la frontera para no filtrar el desalineo al plugin.
 */
export const { GET } = createGetRecommendationsRoute({
  sdk: sdk as unknown as Parameters<typeof createGetRecommendationsRoute>[0]['sdk'],
  cookies: {
    getCartId: async () => (await getCartId()) ?? null,
    getActiveSalesChannelId: async () => (await getActiveSalesChannelId()) ?? null,
    getAuthHeaders: async () => {
      const headers = await getAuthHeaders()
      return (headers ?? {}) as Record<string, string>
    },
  },
  getRegion: async (countryCode: string) => (await getRegion(countryCode)) ?? null,
})
