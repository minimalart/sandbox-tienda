import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { TechFeaturedCategoriesConfig } from "@lib/site-config/types";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

/**
 * Categorías destacadas — grid premium tipo Apple / Best Buy.
 *
 * Cards limpias con imagen grande, nombre y link. En mobile es un carrusel
 * horizontal con snap; en desktop, una grilla aireada.
 */
export default function TechCategories({
  config,
}: {
  config?: TechFeaturedCategoriesConfig;
}) {
  const categories = config?.categories ?? [];
  if (categories.length === 0) return null;

  return (
    <section className="tech-home bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="tech-section-title">
              {config?.title ?? "Explorá por categoría"}
            </h2>
            {config?.subtitle && (
              <p className="tech-section-subtitle">{config.subtitle}</p>
            )}
          </div>
        </div>

        <div className="tech-no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
          {categories.map((cat) => (
            <LocalizedClientLink
              key={cat.id}
              href={cat.href}
              className="group relative flex min-w-[68%] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-[--tech-hairline] transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] sm:min-w-0"
              style={{ backgroundColor: cat.backgroundColor ?? "var(--tech-parchment)" }}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                {cat.image && (
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    sizes="(max-width: 640px) 70vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    unoptimized={/^https?:\/\//i.test(cat.image)}
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 px-5 py-4">
                <span className="text-[17px] font-semibold tracking-tight text-[--tech-ink]">
                  {cat.name}
                </span>
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-white text-[--tech-blue] shadow-sm transition group-hover:bg-[--tech-blue] group-hover:text-white">
                  <ArrowRight className="size-4" />
                </span>
              </div>
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  );
}
