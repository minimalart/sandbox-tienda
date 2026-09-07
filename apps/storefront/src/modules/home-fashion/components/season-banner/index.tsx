import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { FashionSeasonBannerConfig } from "@lib/site-config/types";
import Image from "next/image";

/**
 * Banner de temporada — bloque visual grande, full-width.
 *
 * Fotografía protagonista con un título de temporada ("Summer Essentials") y
 * CTA discreto. Construye temporada y deseo, sin precios ni descuentos.
 */
export default function SeasonBanner({
  config,
}: {
  config?: FashionSeasonBannerConfig;
}) {
  if (!config?.title || !config.image) return null;

  const isDark = config.theme !== "light";
  const align = config.align ?? "center";
  const justify =
    align === "left"
      ? "items-start text-left"
      : align === "right"
        ? "items-end text-right"
        : "items-center text-center";

  return (
    <section className={`fashion-home relative ${isDark ? "f-on-dark" : ""}`}>
      <div className="relative h-[70vh] min-h-[420px] w-full">
        <Image
          src={config.image}
          alt={config.title}
          fill
          sizes="100vw"
          className="object-cover"
          unoptimized={/^https?:\/\//i.test(config.image)}
        />
        <div
          className={`absolute inset-0 ${
            isDark ? "bg-black/30" : "bg-white/20"
          }`}
        />
        <div
          className={`absolute inset-0 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20 ${justify} ${isDark ? "text-[--f-on-dark]" : "text-[--f-ink]"}`}
        >
          {config.eyebrow && <p className="f-eyebrow mb-4">{config.eyebrow}</p>}
          <h2 className="f-display text-[clamp(2.5rem,1.8rem+4vw,5rem)]">
            {config.title}
          </h2>
          {config.subtitle && (
            <p className="mt-4 max-w-md text-base font-light tracking-wide sm:text-lg">
              {config.subtitle}
            </p>
          )}
          {config.cta && (
            <div className="mt-8">
              <LocalizedClientLink href={config.cta.href} className="f-btn-solid">
                {config.cta.text}
              </LocalizedClientLink>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
