import 'server-only'

import { NextResponse } from 'next/server'
import { loyaltyFetch } from '@lib/data/loyalty'

/** GET /api/store/loyalty/tier — nivel actual del cliente y su progreso. */
export async function GET() {
  const result = await loyaltyFetch<{
    tier?: unknown
    next?: unknown
    toNext?: number
    metrics?: unknown
  }>('/store/loyalty/tier')

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    tier: result.data.tier ?? null,
    next: result.data.next ?? null,
    toNext: result.data.toNext ?? 0,
    metrics: result.data.metrics ?? null,
  })
}
