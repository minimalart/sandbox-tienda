import type { SportsCollectionsConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

/**
 * Colecciones (Running Essentials, Train Hard, Match Day).
 *
 * Tres bloques grandes full-bleed con título en mayúsculas y CTA. Cada uno
 * lleva a una colección / búsqueda. En mobile se apilan; en desktop, 3 columnas.
 */
export default function SportsCollections({
  config,
}: {
  config?: SportsCollectionsConfig;
}) {
  const collections = config?.collections ?? [];
  if (collections.length === 0) return null;

  return (
    <section className="sports-home bg-[--sp-paper] py-12 sm:py-16">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
        {(config?.title || config?.subtitle) && (
          <div className="mb-7">
            {config?.title && (
              <h2 className="sp-section-title">{config.title}</h2>
            )}
            {config?.subtitle && (
              <p className="sp-section-subtitle">{config.subtitle}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {collections.map((col) => {
            const isDark = col.theme !== "light";
            return (
              <LocalizedClientLink
                key={col.id}
                href={col.href}
                className={`group relative flex aspect-[3/4] overflow-hidden sm:aspect-[4/5] ${isDark ? "sp-on-dark" : ""}`}
              >
                <Image
                  src={col.image}
                  alt={col.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover transition duration-700 ease-out group-hover:scale-[1.05]"
                  unoptimized={/^https?:\/\//i.test(col.image)}
                />
                <div
                  className={`absolute inset-0 ${isDark ? "bg-black/35" : "bg-white/20"}`}
                />
                <div
                  className={`relative z-10 mt-auto w-full p-6 ${isDark ? "text-[--sp-on-dark]" : "text-[--sp-ink]"}`}
                >
                  {col.subtitle && (
                    <p className="sp-eyebrow mb-2">{col.subtitle}</p>
                  )}
                  <h3 className="sp-display text-3xl sm:text-4xl">{col.name}</h3>
                  <span className="sp-cta mt-4 inline-flex">
                    Comprar <ArrowRight className="size-4" strokeWidth={2} />
                  </span>
                </div>
              </LocalizedClientLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
