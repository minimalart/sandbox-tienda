import 'server-only'

import { NextResponse } from 'next/server'
import { loyaltyFetch } from '@lib/data/loyalty'

type PointsTransaction = {
  id: string
  amount: number
  type: string
  reference: string | null
  reference_id: string | null
  created_at: string
}

/**
 * BFF de puntos para la pantalla "Mis puntos" de la cuenta.
 *
 * Existe porque los componentes del plugin de fidelización pegan a esta ruta de
 * la app; sin el archivo, el fetch se comía el 404 de Next y la pantalla decía
 * "No se pudieron cargar tus puntos". Ver `@lib/data/loyalty` por qué el host
 * no puede re-exportar el handler del plugin (cookie de sesión multitienda).
 */
export async function GET() {
  const result = await loyaltyFetch<{
    points?: { balance?: number; transactions?: PointsTransaction[] }
  }>('/store/points')

  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.message },
      { status: result.status },
    )
  }

  return NextResponse.json({
    success: true,
    points: {
      balance: result.data.points?.balance ?? 0,
      transactions: result.data.points?.transactions ?? [],
    },
  })
}

/** POST /api/store/points — canje directo de puntos. Body: `{ action: "redeem", amount }`. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as Record<string, unknown>)
  const { action, amount } = body as { action?: string; amount?: unknown }

  if (action !== 'redeem') {
    return NextResponse.json({ success: false, message: 'Acción inválida' }, { status: 400 })
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json(
      { success: false, message: 'amount debe ser un número positivo' },
      { status: 400 },
    )
  }

  const result = await loyaltyFetch<{ balance?: number; redeemed?: number }>(
    '/store/points/redeem',
    { method: 'POST', body: { amount } },
  )

  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.message },
      { status: result.status },
    )
  }

  return NextResponse.json({
    success: true,
    balance: result.data.balance ?? 0,
    redeemed: result.data.redeemed ?? amount,
  })
}
