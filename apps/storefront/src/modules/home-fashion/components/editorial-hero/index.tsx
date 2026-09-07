import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { FashionHeroConfig } from "@lib/site-config/types";
import Image from "next/image";

/**
 * Hero editorial del template Moda — la pieza más importante del template.
 *
 * Fotografía de campaña full-width, mucho aire y un CTA discreto (Zara / COS /
 * Aime Leon Dore). Sin banners promocionales ni descuentos: la imagen y el
 * copy construyen deseo. Admite arte distinto para mobile.
 */
export default function EditorialHero({ hero }: { hero?: FashionHeroConfig }) {
  if (!hero?.title || !hero.image) return null;

  const isDark = hero.theme !== "light";
  const align = hero.align ?? "left";
  const vAlign = hero.verticalAlign ?? "bottom";

  const alignItems =
    vAlign === "top"
      ? "items-start"
      : vAlign === "center"
        ? "items-center"
        : "items-end";
  const justify =
    align === "center"
      ? "justify-center text-center"
      : align === "right"
        ? "justify-end text-right"
        : "justify-start text-left";

  return (
    <section
      className={`fashion-home relative ${isDark ? "f-on-dark" : ""}`}
    >
      <div className="relative h-[78vh] min-h-[460px] w-full sm:h-[88vh] lg:h-[92vh]">
        {/* Imagen mobile / desktop */}
        {hero.imageMobile ? (
          <>
            <Image
              src={hero.imageMobile}
              alt={hero.title}
              fill
              priority
              sizes="100vw"
              className="object-cover sm:hidden"
              unoptimized={/^https?:\/\//i.test(hero.imageMobile)}
            />
            <Image
              src={hero.image}
              alt={hero.title}
              fill
              priority
              sizes="100vw"
              className="hidden object-cover sm:block"
              unoptimized={/^https?:\/\//i.test(hero.image)}
            />
          </>
        ) : (
          <Image
            src={hero.image}
            alt={hero.title}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            unoptimized={/^https?:\/\//i.test(hero.image)}
          />
        )}

        {/* Veil sutil para legibilidad del copy */}
        <div
          className={`absolute inset-0 ${
            isDark
              ? "bg-gradient-to-t from-black/45 via-black/10 to-transparent"
              : "bg-gradient-to-t from-white/40 via-transparent to-transparent"
          }`}
        />

        {/* Copy */}
        <div
          className={`absolute inset-0 flex ${alignItems} ${justify} ${isDark ? "text-[--f-on-dark]" : "text-[--f-ink]"}`}
        >
          <div className="w-full max-w-2xl px-6 pb-12 sm:px-12 sm:pb-16 lg:px-20 lg:pb-20">
            {hero.eyebrow && (
              <p className="f-eyebrow mb-4">{hero.eyebrow}</p>
            )}
            <h1 className="f-display text-[clamp(2.75rem,2rem+5vw,6rem)]">
              {hero.title}
            </h1>
            {hero.subtitle && (
              <p className="mt-4 max-w-md text-base font-light tracking-wide sm:text-lg">
                {hero.subtitle}
              </p>
            )}
            {hero.cta && (
              <div
                className={`mt-8 flex ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"}`}
              >
                <LocalizedClientLink href={hero.cta.href} className="f-cta">
                  {hero.cta.text}
                </LocalizedClientLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
