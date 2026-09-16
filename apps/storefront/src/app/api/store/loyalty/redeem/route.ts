import 'server-only'

import { NextResponse } from 'next/server'
import { loyaltyFetch } from '@lib/data/loyalty'

/** POST /api/store/loyalty/redeem — canjea una recompensa. Body: `{ reward_id }`. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as Record<string, unknown>)
  const rewardId = (body as { reward_id?: unknown }).reward_id

  if (!rewardId || typeof rewardId !== 'string') {
    return NextResponse.json({ success: false, message: 'reward_id requerido' }, { status: 400 })
  }

  const result = await loyaltyFetch<{ grant?: unknown; already?: boolean }>(
    '/store/loyalty/redeem',
    { method: 'POST', body: { reward_id: rewardId } },
  )

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    grant: result.data.grant,
    already: result.data.already ?? false,
  })
}
