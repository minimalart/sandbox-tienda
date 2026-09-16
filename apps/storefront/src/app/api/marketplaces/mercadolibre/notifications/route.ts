import { forwardMarketplaceNotification } from '@lib/marketplaces/bridge'

export const dynamic = 'force-dynamic'

export function POST(request: Request): Promise<Response> {
  return forwardMarketplaceNotification(request, process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL)
}
