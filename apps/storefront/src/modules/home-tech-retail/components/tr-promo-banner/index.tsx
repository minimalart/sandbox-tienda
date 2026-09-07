import type { TechSecondaryBannerConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Image from "next/image";

/**
 * Banner promocional horizontal reutilizable (Gaming, Home Office, etc.).
 *
 * Imagen full-bleed con overlay, eyebrow, título, bajada y CTA. Tono claro u
 * oscuro. Se usa para los bloques opcionales Gaming y Home Office del template
 * Tecnología Retail.
 */
export default function TrPromoBanner({
  config,
  ctaVariant = "primary",
}: {
  config?: TechSecondaryBannerConfig;
  /** Estilo del CTA: azul (primary) o rojo (accent). */
  ctaVariant?: "primary" | "accent";
}) {
  if (!config?.title || !config.image) return null;
  const isDark = config.theme !== "light";

  return (
    <section className="tech-retail-home bg-white py-4 sm:py-6">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div
          className={`relative overflow-hidden rounded-2xl ${isDark ? "text-white" : "text-[--tr-ink]"}`}
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
                ? "bg-gradient-to-r from-black/80 via-black/50 to-transparent"
                : "bg-gradient-to-r from-white/90 via-white/60 to-transparent"
            }`}
          />
          <div className="relative z-10 flex min-h-[220px] max-w-lg flex-col justify-center gap-3 px-6 py-10 sm:min-h-[280px] sm:px-10">
            {config.eyebrow && (
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-[--tr-red]">
                {config.eyebrow}
              </p>
            )}
            <h2 className="text-[clamp(1.5rem,1.2rem+1.8vw,2.5rem)] font-extrabold leading-[1.07] tracking-[-0.02em]">
              {config.title}
            </h2>
            {config.subtitle && (
              <p
                className={`max-w-md text-[15px] leading-relaxed ${isDark ? "text-white/85" : "text-[--tr-muted]"}`}
              >
                {config.subtitle}
              </p>
            )}
            {config.cta && (
              <div className="mt-2">
                <LocalizedClientLink
                  href={config.cta.href}
                  className={ctaVariant === "accent" ? "tr-btn-accent" : "tr-btn-primary"}
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
