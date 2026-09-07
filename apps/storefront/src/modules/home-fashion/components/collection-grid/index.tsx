import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { FashionCollectionsConfig } from "@lib/site-config/types";
import Image from "next/image";

/**
 * Colecciones destacadas — grid editorial con fotografía protagonista.
 *
 * Mujer, Hombre, Calzado, Accesorios, Nueva Colección. Cards full-bleed con el
 * nombre superpuesto; algunas pueden ocupar más espacio (`span`) para romper la
 * grilla y darle ritmo editorial. En mobile es un carrusel con swipe.
 */
export default function CollectionGrid({
  config,
}: {
  config?: FashionCollectionsConfig;
}) {
  const collections = config?.collections ?? [];
  if (collections.length === 0) return null;

  const layoutClass = (index: number, span?: string) => {
    if (span === "tall") {
      return "sm:col-span-1 sm:row-span-2 sm:aspect-auto";
    }
    if (span === "wide") {
      return "sm:col-span-2 sm:aspect-auto lg:col-span-2";
    }
    return index === 3 ? "lg:col-start-2" : "";
  };

  return (
    <section className="fashion-home bg-[--f-canvas] py-14 sm:py-20">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
        {(config?.title || config?.subtitle) && (
          <div className="mb-8 sm:mb-10">
            {config?.title && (
              <h2 className="f-section-title">{config.title}</h2>
            )}
            {config?.subtitle && (
              <p className="f-section-subtitle">{config.subtitle}</p>
            )}
          </div>
        )}

        <div className="f-no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:grid-rows-[repeat(4,minmax(220px,28vw))] sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-3 lg:grid-rows-[repeat(3,minmax(240px,22vw))]">
          {collections.map((col, index) => {
            const isDark = col.theme !== "light";
            return (
              <LocalizedClientLink
                key={col.id}
                href={col.href}
                className={`group relative flex min-w-[78%] shrink-0 snap-start overflow-hidden aspect-[3/4] sm:aspect-auto sm:min-w-0 ${layoutClass(index, col.span)}`}
              >
                <Image
                  src={col.image}
                  alt={col.name}
                  fill
                  sizes="(max-width: 640px) 78vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
                  unoptimized={/^https?:\/\//i.test(col.image)}
                />
                <div
                  className={`absolute inset-0 ${
                    isDark
                      ? "bg-gradient-to-t from-black/40 via-transparent to-transparent"
                      : "bg-gradient-to-t from-white/30 via-transparent to-transparent"
                  }`}
                />
                <div
                  className={`relative z-10 mt-auto w-full p-5 sm:p-6 ${isDark ? "text-[--f-on-dark]" : "text-[--f-ink]"}`}
                >
                  {col.label && (
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] opacity-80">
                      {col.label}
                    </p>
                  )}
                  <h3 className="f-display text-2xl sm:text-3xl">{col.name}</h3>
                </div>
              </LocalizedClientLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
