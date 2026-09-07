import type { TechFeaturedBrandsConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Image from "next/image";

/**
 * Marcas destacadas (BrandCarousel) — bloque obligatorio del template.
 *
 * Rail horizontal de marcas líderes (Samsung, LG, Motorola, Sony, Philips,
 * Lenovo…). Si la marca trae logo se muestra la imagen; si no, el nombre con
 * tipografía marcada. En mobile hace scroll; en desktop una grilla.
 */
export default function BrandCarousel({
  config,
}: {
  config?: TechFeaturedBrandsConfig;
}) {
  const brands = config?.brands ?? [];
  if (brands.length === 0) return null;

  return (
    <section className="tech-retail-home bg-[--tr-surface] py-10 sm:py-12">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="tr-section-title">
            {config?.title ?? "Marcas destacadas"}
          </h2>
          {config?.subtitle && (
            <p className="tr-section-subtitle">{config.subtitle}</p>
          )}
        </div>

        <div className="tr-no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-8">
          {brands.map((brand) => (
            <LocalizedClientLink
              key={brand.id}
              href={brand.href}
              className="group flex h-20 min-w-[42%] shrink-0 snap-start items-center justify-center rounded-2xl border border-[--tr-hairline] bg-white px-4 transition hover:-translate-y-0.5 hover:border-[--tr-blue] hover:shadow-sm sm:min-w-0"
              aria-label={brand.name}
            >
              {brand.logo ? (
                <Image
                  src={brand.logo}
                  alt={brand.name}
                  width={120}
                  height={40}
                  className="max-h-9 w-auto object-contain opacity-80 transition group-hover:opacity-100"
                  unoptimized={/^https?:\/\//i.test(brand.logo)}
                />
              ) : (
                <span className="text-[18px] font-extrabold tracking-tight text-[--tr-ink]">
                  {brand.name}
                </span>
              )}
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  );
}
