import type { SportsCategoriesConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Image from "next/image";

/**
 * Categorías de producto (Calzado, Indumentaria, Accesorios).
 *
 * Tres tiles anchos con imagen y nombre superpuesto en mayúsculas. Navegación
 * simple y directa a cada categoría.
 */
export default function SportsCategories({
  config,
}: {
  config?: SportsCategoriesConfig;
}) {
  const items = config?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="sports-home bg-[--sp-canvas] py-12 sm:py-16">
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
          {items.map((item) => (
            <LocalizedClientLink
              key={item.id}
              href={item.href}
              className="sp-on-dark group relative flex aspect-[16/10] overflow-hidden sm:aspect-[4/5]"
            >
              {item.image && (
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover transition duration-700 ease-out group-hover:scale-[1.05]"
                  unoptimized={/^https?:\/\//i.test(item.image)}
                />
              )}
              <div className="absolute inset-0 bg-black/30 transition group-hover:bg-black/40" />
              <div className="relative z-10 flex h-full w-full items-center justify-center text-[--sp-on-dark]">
                <h3 className="sp-display text-3xl sm:text-4xl">{item.name}</h3>
              </div>
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  );
}
