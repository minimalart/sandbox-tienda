import { sdk } from '@lib/config'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function validToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(token)
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  if (!validToken(token)) return NextResponse.json({ message: 'No disponible.' }, { status: 404 })
  try {
    const data = await sdk.client.fetch(`/store/gift-card-experience/landing/${encodeURIComponent(token)}`, {
      method: 'GET', cache: 'no-store',
    })
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
  } catch {
    return NextResponse.json({ message: 'Esta gift card no está disponible.' }, { status: 404 })
  }
}

export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const authToken = (await cookies()).get('_medusa_jwt')?.value
  if (!authToken) return NextResponse.json({ message: 'No autenticado.' }, { status: 401 })
  if (!validToken(token)) return NextResponse.json({ message: 'No disponible.' }, { status: 404 })
  try {
    const data = await sdk.client.fetch(`/store/gift-card-experience/landing/${encodeURIComponent(token)}/claim`, {
      method: 'POST', headers: { authorization: `Bearer ${authToken}` }, cache: 'no-store',
    })
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ message: 'Esta gift card no está disponible.' }, { status: 404 })
  }
}
