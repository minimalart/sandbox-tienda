import 'server-only'

import { NextResponse } from 'next/server'
import { loyaltyFetch } from '@lib/data/loyalty'

/** GET /api/store/loyalty/rewards — recompensas canjeables del programa activo. */
export async function GET() {
  const result = await loyaltyFetch<{ rewards?: unknown[]; points_name?: string }>(
    '/store/loyalty/rewards',
  )

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    rewards: result.data.rewards ?? [],
    points_name: result.data.points_name ?? 'puntos',
  })
}
