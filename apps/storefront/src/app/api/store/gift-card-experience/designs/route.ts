import { sdk } from '@lib/config'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const data = await sdk.client.fetch('/store/gift-card-experience/designs', {
      method: 'GET',
      next: { revalidate: 60 },
    })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { designs: [], message: 'No se pudieron cargar los diseños.' },
      { status: 502 },
    )
  }
}
