import LocalizedClientLink from '@modules/common/components/localized-client-link';
import { Button } from '@/components/ui/button';

type Props = Record<string, any>;
const wrap = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8';

export function ImageText(p: Props & { hero?: boolean }) {
  const Title = p.hero ? 'h1' : 'h2';
  return (
    <section
      className="py-10 sm:py-16"
      style={{ backgroundColor: p.background || undefined, color: p.textColor || undefined }}
    >
      <div
        className={`${wrap} grid items-center gap-8 ${p.image ? 'md:grid-cols-2 md:gap-14' : ''}`}
      >
        {p.image ? (
          <div className={p.imagePosition === 'right' ? 'md:order-2' : ''}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image}
              alt={p.alt || ''}
              loading={p.hero ? 'eager' : 'lazy'}
              className={`w-full rounded-3xl object-cover ${p.hero ? 'aspect-[4/3]' : 'aspect-square'}`}
            />
          </div>
        ) : null}
        <div className="flex max-w-xl flex-col items-start gap-5">
          {p.eyebrow ? (
            <p className="text-sm font-semibold uppercase tracking-widest">{p.eyebrow}</p>
          ) : null}
          {p.heading ? (
            <Title
              className={
                p.hero
                  ? 'text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl'
                  : 'text-3xl font-semibold tracking-tight sm:text-4xl'
              }
            >
              {p.heading}
            </Title>
          ) : null}
          {p.text ? (
            <p className="whitespace-pre-line text-lg leading-relaxed opacity-80">{p.text}</p>
          ) : null}
          {p.ctaHref && p.ctaLabel ? (
            <Button asChild size="storefront" variant="storefront">
              <LocalizedClientLink
                href={p.ctaHref}
                style={p.accentColor ? { backgroundColor: p.accentColor } : undefined}
              >
                {p.ctaLabel}
              </LocalizedClientLink>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid(p: Props) {
  const items: Array<{ title?: string; text?: string }> = Array.isArray(p.items) ? p.items : [];
  if (!items.length) return null;
  return (
    <section
      className="py-10 sm:py-14"
      style={{ backgroundColor: p.background || undefined, color: p.textColor || undefined }}
    >
      <div className={wrap}>
        {p.heading ? (
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">{p.heading}</h2>
        ) : null}
        {p.description ? (
          <p className="mt-4 max-w-2xl text-lg opacity-80">{p.description}</p>
        ) : null}
        <div
          className={`mt-8 grid gap-4 sm:grid-cols-2 ${items.length === 3 || items.length > 4 ? 'lg:grid-cols-3' : ''}`}
        >
          {items.map((item, index) => (
            <article key={index} className="rounded-2xl border border-current/15 p-6 sm:p-8">
              <span
                aria-hidden="true"
                className="mb-6 block text-sm font-semibold tabular-nums opacity-50"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 whitespace-pre-line leading-relaxed opacity-80">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
