import type { Metadata } from 'next'
import GiftCardLanding from './gift-card-landing'

export const metadata: Metadata = { title: 'Recibiste una gift card', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <GiftCardLanding token={token} />
}
