import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { TechHeroConfig } from "@lib/site-config/types";
import Image from "next/image";

/**
 * Hero principal del template Tecnología.
 *
 * Producto protagonista (Samsung), limpieza visual (Apple) y foco comercial
 * (Frávega): título grande, bajada, promo/precio destacado y dos CTAs. Admite
 * tono claro u oscuro tipo "tile" Apple.
 */
export default function TechHero({ hero }: { hero?: TechHeroConfig }) {
  if (!hero?.title || !hero.image) return null;

  const isDark = hero.theme === "dark";

  return (
    <section
      className={`tech-home relative overflow-hidden ${
        isDark ? "tech-on-dark bg-[--tech-dark] text-white" : "bg-[--tech-parchment] text-[--tech-ink]"
      }`}
    >
      <div className="mx-auto grid max-w-[1440px] items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:gap-6 md:py-16 lg:px-8 lg:py-20">
        {/* Copy */}
        <div className="order-2 max-w-xl md:order-1">
          {hero.eyebrow && (
            <p
              className={`mb-3 text-sm font-semibold uppercase tracking-[0.12em] ${
                isDark ? "text-[--tech-blue-on-dark]" : "text-[--tech-blue]"
              }`}
            >
              {hero.eyebrow}
            </p>
          )}
          <h1 className="text-[clamp(2rem,1.4rem+3vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
            {hero.title}
          </h1>
          {hero.subtitle && (
            <p
              className={`mt-4 text-lg leading-relaxed ${
                isDark ? "text-[#d2d2d7]" : "text-[--tech-muted]"
              }`}
            >
              {hero.subtitle}
            </p>
          )}
          {hero.highlight && (
            <p
              className={`mt-5 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold ${
                isDark
                  ? "text-[--tech-blue-on-dark]"
                  : "text-[--tech-blue]"
              }`}
              style={{
                backgroundColor: isDark
                  ? "rgba(41,151,255,0.14)"
                  : "rgba(0,102,204,0.10)",
              }}
            >
              {hero.highlight}
            </p>
          )}
          {hero.price && (
            <p className="mt-4 text-2xl font-semibold tracking-tight">{hero.price}</p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {hero.primaryCta && (
              <LocalizedClientLink
                href={hero.primaryCta.href}
                className="tech-btn-primary"
              >
                {hero.primaryCta.text}
              </LocalizedClientLink>
            )}
            {hero.secondaryCta && (
              <LocalizedClientLink
                href={hero.secondaryCta.href}
                className="tech-btn-secondary"
              >
                {hero.secondaryCta.text}
              </LocalizedClientLink>
            )}
          </div>
        </div>

        {/* Imagen de producto */}
        <div className="order-1 md:order-2">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-xl">
            <Image
              src={hero.image}
              alt={hero.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain drop-shadow-[0_5px_30px_rgba(0,0,0,0.22)]"
              unoptimized={/^https?:\/\//i.test(hero.image)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
