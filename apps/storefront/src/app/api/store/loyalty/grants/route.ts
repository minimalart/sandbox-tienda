import 'server-only'

import { NextResponse } from 'next/server'
import { loyaltyFetch } from '@lib/data/loyalty'

/** GET /api/store/loyalty/grants — los beneficios que el cliente ya canjeó. */
export async function GET() {
  const result = await loyaltyFetch<{ grants?: unknown[] }>('/store/loyalty/grants')

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status })
  }

  return NextResponse.json({ success: true, grants: result.data.grants ?? [] })
}
