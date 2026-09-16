import { getLandingPageBySlug } from '@lib/data/landing-pages'
import LandingRenderer from '@modules/landing-page/components/landing-renderer'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type Params = { countryCode: string; slug: string }
type Props = {
  params: Promise<Params>
  searchParams: Promise<{ preview?: string }>
}

export const dynamic = 'force-dynamic'

const isPreview = (value?: string) => value === '1' || value === 'true'

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params
  const preview = isPreview((await props.searchParams).preview)
  const landing = await getLandingPageBySlug(slug, undefined, preview)
  if (!landing) {
    return { title: 'No encontrado', ...(preview ? { robots: { index: false, follow: false } } : {}) }
  }
  const title = landing.seo?.title || landing.title
  const description = landing.seo?.description || landing.description || undefined
  return {
    title,
    description,
    robots: preview || landing.seo?.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      images: landing.seo?.image ? [{ url: landing.seo.image }] : undefined,
    },
  }
}

export default async function LandingPageRoute(props: Props) {
  const { slug, countryCode } = await props.params
  const preview = isPreview((await props.searchParams).preview)
  const landing = await getLandingPageBySlug(slug, undefined, preview)
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
