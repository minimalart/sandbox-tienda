import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { TechSecondaryBannerConfig } from "@lib/site-config/types";
import Image from "next/image";

/**
 * Banner secundario horizontal de campaña (Renová tu TV, Setup gamer, etc.).
 * Imagen full-bleed con texto y CTA, tono claro u oscuro.
 */
export default function TechSecondaryBanner({
  config,
}: {
  config?: TechSecondaryBannerConfig;
}) {
  if (!config?.title || !config.image) return null;
  const isDark = config.theme !== "light";

  return (
    <section className="tech-home bg-white py-6 sm:py-10">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div
          className={`relative overflow-hidden rounded-[28px] ${
            isDark ? "tech-on-dark text-white" : "text-[--tech-ink]"
          }`}
        >
          <Image
            src={config.image}
            alt={config.title}
            fill
            sizes="(max-width: 1440px) 100vw, 1440px"
            className="object-cover"
            unoptimized={/^https?:\/\//i.test(config.image)}
          />
          <div
            className={`absolute inset-0 ${
              isDark
                ? "bg-gradient-to-r from-black/75 via-black/45 to-transparent"
                : "bg-gradient-to-r from-white/90 via-white/55 to-transparent"
            }`}
          />
          <div className="relative z-10 flex min-h-[260px] max-w-xl flex-col justify-center gap-4 px-6 py-12 sm:min-h-[320px] sm:px-12">
            {config.eyebrow && (
              <p
                className={`text-sm font-semibold uppercase tracking-[0.12em] ${
                  isDark ? "text-[--tech-blue-on-dark]" : "text-[--tech-blue]"
                }`}
              >
                {config.eyebrow}
              </p>
            )}
            <h2 className="text-[clamp(1.75rem,1.3rem+2vw,2.75rem)] font-semibold leading-[1.07] tracking-[-0.02em]">
              {config.title}
            </h2>
            {config.subtitle && (
              <p
                className={`max-w-md text-base leading-relaxed ${
                  isDark ? "text-white/85" : "text-[--tech-muted]"
                }`}
              >
                {config.subtitle}
              </p>
            )}
            {config.cta && (
              <div className="mt-2">
                <LocalizedClientLink
                  href={config.cta.href}
                  className="tech-btn-primary"
                >
                  {config.cta.text}
                </LocalizedClientLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
