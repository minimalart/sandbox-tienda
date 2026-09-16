import { redirectMarketplaceCallback } from '@lib/marketplaces/bridge'

export const dynamic = 'force-dynamic'

export function GET(request: Request): Response {
  return redirectMarketplaceCallback(request, process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL)
}
