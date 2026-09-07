import type { SportCategoryGridConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

/**
 * Bloque principal del template: deportes.
 *
 * Grilla de deportes (Running, Football, Training, Basketball, Tennis, Outdoor)
 * con fotografía full-bleed, overlay oscuro y el nombre en mayúsculas grandes.
 * En mobile es un carrusel horizontal con snap.
 */
export default function SportCategoryGrid({
  config,
}: {
  config?: SportCategoryGridConfig;
}) {
  const sports = config?.sports ?? [];
  if (sports.length === 0) return null;

  return (
    <section className="sports-home bg-[--sp-paper] py-12 sm:py-16">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
        <div className="mb-7">
          <h2 className="sp-section-title">{config?.title ?? "Elegí tu deporte"}</h2>
          {config?.subtitle && (
            <p className="sp-section-subtitle">{config.subtitle}</p>
          )}
        </div>

        <div className="sp-no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {sports.map((sport) => (
            <LocalizedClientLink
              key={sport.id}
              href={sport.href}
              className="sp-on-dark group relative flex min-w-[72%] shrink-0 snap-start overflow-hidden aspect-[3/4] sm:aspect-[4/5] sm:min-w-0"
            >
              {sport.image && (
                <Image
                  src={sport.image}
                  alt={sport.name}
                  fill
                  sizes="(max-width: 640px) 72vw, 33vw"
                  className="object-cover transition duration-700 ease-out group-hover:scale-[1.05]"
                  unoptimized={/^https?:\/\//i.test(sport.image)}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
              <div className="relative z-10 mt-auto flex w-full items-end justify-between gap-3 p-5 text-[--sp-on-dark]">
                <h3 className="sp-display text-2xl sm:text-3xl">{sport.name}</h3>
                <span className="inline-flex size-9 shrink-0 items-center justify-center bg-white text-[--sp-ink] transition group-hover:bg-[--sp-ink] group-hover:text-white">
                  <ArrowRight className="size-4" strokeWidth={2} />
                </span>
              </div>
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  );
}
