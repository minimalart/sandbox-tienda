import { getLandingPageBySlug } from '@lib/data/landing-pages'
import LandingRenderer from '@modules/landing-page/components/landing-renderer'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type Params = { countryCode: string; slug: string }

export async function generateMetadata(props: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await props.params
  const landing = await getLandingPageBySlug(slug)
  if (!landing) {
    return { title: 'No encontrado' }
  }
  const title = landing.seo?.title || landing.title
  const description = landing.seo?.description || landing.description || undefined
  return {
    title,
    description,
    robots: landing.seo?.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      images: landing.seo?.image ? [{ url: landing.seo.image }] : undefined,
    },
  }
}

export default async function LandingPageRoute(props: {
  params: Promise<Params>
}) {
  const { slug, countryCode } = await props.params
  const landing = await getLandingPageBySlug(slug)
  if (!landing) {
    notFound()
  }
  return (
    <main className="min-h-screen">
      <LandingRenderer
        content={landing.puck_data?.content}
        countryCode={countryCode}
      />
    </main>
  )
}
