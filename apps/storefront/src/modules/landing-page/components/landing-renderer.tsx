import LocalizedClientLink from '@modules/common/components/localized-client-link'
import type { PuckBlock } from '@lib/data/landing-pages'
import type { ReactNode } from 'react'
import LandingProductsBlock from './landing-products-block'
import { Button } from '@/components/ui/button'

/**
 * Renders a landing page from its Puck JSON document. This is the read-only
 * counterpart of the admin Puck config: a controlled mapping from block `type`
 * to our own components, so marketing can compose pages without injecting raw
 * HTML into the storefront.
 *
 * Unknown block types render nothing (forward-compatible with editor changes).
 */

type Props = Record<string, any>

const wrap = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'

function Hero(p: Props) {
  const hasImage = Boolean(p.image)
  return (
    <section
      className="relative flex min-h-[320px] flex-col items-center justify-center gap-4 bg-gray-50 py-16 text-center"
      style={
        hasImage
          ? {
              backgroundImage: `url(${p.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : p.background
            ? { backgroundColor: p.background }
            : undefined
      }
    >
      {/* La imagen se genera sin texto; el copy se superpone acá. El overlay
          oscuro garantiza contraste para que el título/subtítulo se lean sobre
          cualquier foto. */}
      {hasImage ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60"
        />
      ) : null}
      <div className={`${wrap} relative z-10 flex flex-col items-center gap-4`}>
        {p.title ? (
          <h1
            className={`font-bold text-3xl sm:text-5xl ${
              hasImage ? 'text-white drop-shadow-lg' : 'text-gray-900'
            }`}
            style={p.textColor ? { color: p.textColor } : undefined}
          >
            {p.title}
          </h1>
        ) : null}
        {p.subtitle ? (
          <p
            className={`max-w-2xl text-lg ${
              hasImage ? 'text-white/90 drop-shadow' : 'text-gray-600'
            }`}
            style={p.textColor ? { color: p.textColor } : undefined}
          >
            {p.subtitle}
          </p>
        ) : null}
        {p.ctaHref && p.ctaLabel ? (
          <Button asChild className="mt-2" size="storefront" variant="storefront">
            <LocalizedClientLink
              href={p.ctaHref}
              style={p.accentColor ? { backgroundColor: p.accentColor } : undefined}
            >
              {p.ctaLabel}
            </LocalizedClientLink>
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function RichText(p: Props) {
  return (
    <div
      className={`${wrap} py-6`}
      style={p.background ? { backgroundColor: p.background } : undefined}
    >
      {p.heading ? (
        <h2
          className="mb-3 font-semibold text-2xl text-gray-900"
          style={p.textColor ? { color: p.textColor } : undefined}
        >
          {p.heading}
        </h2>
      ) : null}
      <p
        className="whitespace-pre-line text-gray-700 leading-relaxed"
        style={p.textColor ? { color: p.textColor } : undefined}
      >
        {p.text}
      </p>
    </div>
  )
}

function ImageBlock(p: Props) {
  if (!p.src) return null
  return (
    <figure
      className={`${wrap} py-6`}
      style={p.background ? { backgroundColor: p.background } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.src}
        alt={p.alt ?? ''}
        className="h-auto w-full rounded-2xl object-cover"
      />
      {p.caption ? (
        <figcaption
          className="mt-2 text-center text-gray-500 text-sm"
          style={p.textColor ? { color: p.textColor } : undefined}
        >
          {p.caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

function CTA(p: Props) {
  return (
    <section className={`${wrap} py-10`}>
      <div
        className="flex flex-col items-center gap-3 rounded-3xl bg-[--primary-color]/5 px-6 py-12 text-center"
        style={p.background ? { backgroundColor: p.background } : undefined}
      >
        {p.title ? (
          <h2
            className="font-bold text-2xl text-gray-900"
            style={p.textColor ? { color: p.textColor } : undefined}
          >
            {p.title}
          </h2>
        ) : null}
        {p.description ? (
          <p
            className="max-w-xl text-gray-600"
            style={p.textColor ? { color: p.textColor } : undefined}
          >
            {p.description}
          </p>
        ) : null}
        {p.buttonHref && p.buttonLabel ? (
          <Button asChild className="mt-2" size="storefront" variant="storefront">
            <LocalizedClientLink
              href={p.buttonHref}
              style={p.accentColor ? { backgroundColor: p.accentColor } : undefined}
            >
              {p.buttonLabel}
            </LocalizedClientLink>
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function FAQ(p: Props) {
  const items: Array<{ q?: string; a?: string }> = Array.isArray(p.items)
    ? p.items
    : []
  if (items.length === 0) return null
  return (
    <section
      className={`${wrap} py-8`}
      style={p.background ? { backgroundColor: p.background } : undefined}
    >
      {p.heading ? (
        <h2
          className="mb-4 font-semibold text-2xl text-gray-900"
          style={p.textColor ? { color: p.textColor } : undefined}
        >
          {p.heading}
        </h2>
      ) : null}
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <details
            key={i}
            className="rounded-xl border border-gray-200 p-4 [&[open]>summary]:mb-2"
          >
            <summary
              className="cursor-pointer font-medium text-gray-900"
              style={p.textColor ? { color: p.textColor } : undefined}
            >
              {item.q}
            </summary>
            <p
              className="whitespace-pre-line text-gray-600 text-sm"
              style={p.textColor ? { color: p.textColor } : undefined}
            >
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}

function Testimonials(p: Props) {
  const items: Array<{ quote?: string; author?: string }> = Array.isArray(
    p.items,
  )
    ? p.items
    : []
  if (items.length === 0) return null
  return (
    <section
      className={`${wrap} py-8`}
      style={p.background ? { backgroundColor: p.background } : undefined}
    >
      {p.heading ? (
        <h2
          className="mb-4 font-semibold text-2xl text-gray-900"
          style={p.textColor ? { color: p.textColor } : undefined}
        >
          {p.heading}
        </h2>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <blockquote
            key={i}
            className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-5"
          >
            <p
              className="text-gray-700 italic"
              style={p.textColor ? { color: p.textColor } : undefined}
            >
              “{item.quote}”
            </p>
            {item.author ? (
              <footer
                className="font-semibold text-gray-900 text-sm"
                style={p.textColor ? { color: p.textColor } : undefined}
              >
                — {item.author}
              </footer>
            ) : null}
          </blockquote>
        ))}
      </div>
    </section>
  )
}

function Spacer(p: Props) {
  const size = Number(p.size) || 32
  return (
    <div
      style={{
        height: `${size}px`,
        backgroundColor: p.background || undefined,
      }}
      aria-hidden="true"
    />
  )
}

// ProductGrid / CollectionGrid store references (IDs/handles), not full data.
// MVP renders titled links; richer product fetching can layer on later.
function CollectionGrid(p: Props) {
  const items: Array<{ label?: string; href?: string; handle?: string }> =
    Array.isArray(p.items) ? p.items : []
  if (items.length === 0) return null
  return (
    <section
      className={`${wrap} py-8`}
      style={p.background ? { backgroundColor: p.background } : undefined}
    >
      {p.heading ? (
        <h2
          className="mb-4 font-semibold text-2xl text-gray-900"
          style={p.textColor ? { color: p.textColor } : undefined}
        >
          {p.heading}
        </h2>
      ) : null}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, i) => (
          <LocalizedClientLink
            key={i}
            href={item.href ?? `/store?category=${item.handle ?? ''}`}
            className="flex items-center justify-center rounded-2xl border border-gray-200 px-4 py-10 text-center font-medium text-gray-800 transition hover:border-[--primary-color] hover:text-[--primary-color]"
            style={p.textColor ? { color: p.textColor } : undefined}
          >
            {item.label ?? item.handle}
          </LocalizedClientLink>
        ))}
      </div>
    </section>
  )
}

function ProductGrid(p: Props) {
  const href = p.href ?? '/store'
  return (
    <section
      className={`${wrap} py-8 text-center`}
      style={p.background ? { backgroundColor: p.background } : undefined}
    >
      {p.heading ? (
        <h2
          className="mb-3 font-semibold text-2xl text-gray-900"
          style={p.textColor ? { color: p.textColor } : undefined}
        >
          {p.heading}
        </h2>
      ) : null}
      <Button asChild size="storefront" variant="storefrontOutline">
        <LocalizedClientLink href={href}>
          {p.ctaLabel ?? 'Ver productos'}
        </LocalizedClientLink>
      </Button>
    </section>
  )
}

const BLOCKS: Record<
  string,
  (props: Props) => ReactNode | Promise<ReactNode>
> = {
  Hero,
  RichText,
  ImageBlock,
  CTA,
  FAQ,
  Testimonials,
  Spacer,
  CollectionGrid,
  ProductGrid,
  ProductsList: LandingProductsBlock,
}

export default function LandingRenderer({
  content,
  countryCode,
}: {
  content: PuckBlock[] | undefined | null
  countryCode?: string
}) {
  const blocks = Array.isArray(content) ? content : []
  return (
    <div className="flex flex-col">
      {blocks.map((block, index) => {
        const Component = BLOCKS[block?.type]
        if (!Component) return null
        return (
          <Component
            key={index}
            {...(block.props ?? {})}
            countryCode={countryCode}
          />
        )
      })}
    </div>
  )
}
