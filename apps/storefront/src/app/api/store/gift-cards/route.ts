import { sdk } from '@lib/config'
import { getAuthToken } from '@lib/data/cookies'
import { NextResponse } from 'next/server'

async function authToken(): Promise<string | undefined> {
  return await getAuthToken()
}
type Account = { id: string; balance: number; currency_code: string; movements?: unknown[] }

export async function GET() {
  const token = await authToken()
  if (!token) return NextResponse.json({ success: false, message: 'No autenticado' }, { status: 401 })
  try {
    const result = await sdk.client.fetch<{ wallets?: Account[] }>('/store/gift-card-experience/wallet', {
      method: 'GET', headers: { authorization: `Bearer ${token}` }, cache: 'no-store',
    })
    return NextResponse.json({ success: true, accounts: result.wallets ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Error al obtener la billetera' }, { status: 400 })
  }
}

/** Backwards-compatible manual claim for customers who received a legacy code. */
export async function POST(request: Request) {
  const token = await authToken()
  if (!token) return NextResponse.json({ success: false, message: 'No autenticado' }, { status: 401 })
  try {
    const body = await request.json() as { action?: unknown; code?: unknown }
    if (body.action !== 'claim' || typeof body.code !== 'string' || !body.code.trim()) {
      return NextResponse.json({ success: false, message: 'Ingresá un código válido' }, { status: 400 })
    }
    const result = await sdk.client.fetch('/store/store-credit-accounts/claim', {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { code: body.code.trim() }, cache: 'no-store',
    })
    return NextResponse.json({ success: true, account: result })
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Error al canjear la gift card' }, { status: 400 })
  }
}
