import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { TechFeaturedBrandsConfig } from "@lib/site-config/types";
import Image from "next/image";

/**
 * Marcas destacadas — grilla horizontal limpia (Best Buy / B&H).
 *
 * Si la marca trae logo se muestra la imagen; si no, el nombre con
 * tipografía cuidada. Las celdas son neutras para no competir con el resto.
 */
export default function TechBrands({
  config,
}: {
  config?: TechFeaturedBrandsConfig;
}) {
  const brands = config?.brands ?? [];
  if (brands.length === 0) return null;

  return (
    <section className="tech-home bg-[--tech-parchment] py-12 sm:py-16">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="tech-section-title">
            {config?.title ?? "Marcas destacadas"}
          </h2>
          {config?.subtitle && (
            <p className="tech-section-subtitle">{config.subtitle}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-8">
          {brands.map((brand) => (
            <LocalizedClientLink
              key={brand.id}
              href={brand.href}
              className="group flex h-20 items-center justify-center rounded-2xl border border-[--tech-hairline] bg-white px-4 transition hover:-translate-y-0.5 hover:border-[--tech-blue] hover:shadow-sm"
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
                <span className="text-[17px] font-semibold tracking-tight text-[--tech-ink]">
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
