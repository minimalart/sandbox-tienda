import type { TechFeaturedCategoriesConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Image from "next/image";

/**
 * Categorías destacadas — grilla densa de retail (Frávega / Cetrogar).
 *
 * Cards compactas con imagen, nombre y fondo de color. En mobile es un carrusel
 * horizontal con snap; en desktop una grilla de muchas columnas.
 */
export default function TechCategoryGrid({
  config,
}: {
  config?: TechFeaturedCategoriesConfig;
}) {
  const categories = config?.categories ?? [];
  if (categories.length === 0) return null;

  return (
    <section className="tech-retail-home bg-white py-10 sm:py-12">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="tr-section-title">
            {config?.title ?? "Categorías destacadas"}
          </h2>
          {config?.subtitle && (
            <p className="tr-section-subtitle">{config.subtitle}</p>
          )}
        </div>

        <div className="tr-no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 xl:grid-cols-7">
          {categories.map((cat) => (
            <LocalizedClientLink
              key={cat.id}
              href={cat.href}
              className="group flex min-w-[40%] shrink-0 snap-start flex-col items-center overflow-hidden rounded-2xl border border-[--tr-hairline] bg-white p-3 text-center transition hover:-translate-y-0.5 hover:border-[--tr-blue] hover:shadow-md sm:min-w-0"
            >
              <div
                className="relative aspect-square w-full overflow-hidden rounded-xl"
                style={{ backgroundColor: cat.backgroundColor ?? "var(--tr-surface)" }}
              >
                {cat.image && (
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    sizes="(max-width: 640px) 40vw, (max-width: 1280px) 25vw, 14vw"
                    className="object-cover transition duration-300 group-hover:scale-[1.05]"
                    unoptimized={/^https?:\/\//i.test(cat.image)}
                  />
                )}
              </div>
              <span className="mt-3 text-[14px] font-semibold leading-tight tracking-tight text-[--tr-ink]">
                {cat.name}
              </span>
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  );
}
