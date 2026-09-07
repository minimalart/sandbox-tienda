import { getActiveTenant } from "@lib/site-config/active-tenant";
import { searchTypesenseProducts } from "@lib/typesense";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import ProductImage from "@modules/common/components/product-image";
import Reveal from "@modules/common/components/reveal";
import { ArrowUpRight } from "lucide-react";

type NewArrivalsSectionProps = {
  countryCode: string;
};

// Valores por defecto (fallback)
const DEFAULT_PRODUCT_IDS = [
  "prod_01KB0S56K52C4F37D3TYWXWPQA",
  "prod_01K2F9TV3Q7XG32942QWCE0RAF",
  "prod_01K5C4CN96CH36EWF61KB5ZJV0",
];

const DEFAULT_BACKGROUNDS = ["#e6f2ff", "#EAF0E8", "#EEECEB", "#f8f1f5"];

const getProductLabel = (title?: string) => {
  if (!title) return "Producto";
  const [firstWord] = title.split(" ");
  return firstWord || title;
};

export default async function NewArrivalsSection({
  countryCode,
}: NewArrivalsSectionProps) {
  const tenant = await getActiveTenant();
  const newArrivalsConfig = tenant.assets.newArrivals;

  // Usar configuración del tenant o valores por defecto
  const productIds =
    newArrivalsConfig?.products?.map((p) => p.productId) || DEFAULT_PRODUCT_IDS;
  const sectionTitle = newArrivalsConfig?.title || "Novedades";
  const sectionSubtitle = newArrivalsConfig?.subtitle || "Novedades";
  const backgrounds = newArrivalsConfig?.backgrounds || DEFAULT_BACKGROUNDS;
  const viewAllCard = newArrivalsConfig?.viewAllCard;

  const { products: fetchedProducts } = await searchTypesenseProducts({
    productIds,
    limit: productIds.length,
  });

  if (!fetchedProducts.length) {
    return null;
  }

  // Ordenar productos según el orden de productIds
  const products = productIds
    .map((id) => fetchedProducts.find((p) => p.id === id))
    .filter(Boolean) as typeof fetchedProducts;

  return (
    <Reveal as="section" className="bg-gray-50 py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="home-section-heading">{sectionTitle}</p>
          <p className="mt-1 text-sm font-normal text-gray-500 sm:text-base">
            {sectionSubtitle}
          </p>
        </div>

        <div className="relative -mx-4 sm:mx-0">
          <div className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 sm:px-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible lg:grid-cols-4">
            {products.map((product, index) => {
              const productConfig = newArrivalsConfig?.products?.[index];
              const isHighlight = index === 0;

              // Usar configuración del tenant o valores por defecto
              const backgroundColor =
                productConfig?.backgroundColor ||
                (isHighlight
                  ? "#EBF1F6"
                  : backgrounds[index % backgrounds.length]);

              const imageSrc =
                productConfig?.image ||
                product.thumbnail ||
                product.images?.[0]?.url ||
                "/images/category-difusores.webp";

              const label =
                productConfig?.label || getProductLabel(product.title);
              return (
                <Reveal
                  as="article"
                  className="flex basis-[calc(100%/1.5)] flex-none snap-start flex-col rounded-3xl p-6 shadow-sm ring-1 ring-gray-100 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg md:flex-1 md:basis-auto"
                  delay={index * 80}
                  key={product.id}
                  style={{ backgroundColor }}
                >
                  <div
                    className={`relative mb-6 h-48 w-full overflow-hidden rounded-2xl ${
                      isHighlight ? "" : ""
                    }`}
                  >
                    <ProductImage
                      alt={product.title ?? "Producto"}
                      className="object-cover"
                      fill
                      sizes="(max-width: 1024px) 50vw, 280px"
                      src={imageSrc}
                    />
                  </div>

                  <div className="mt-auto">
                    <LocalizedClientLink
                      className="inline-flex items-center rounded bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition-colors"
                      href={`/products/${product.handle}`}
                    >
                      {label}
                    </LocalizedClientLink>
                  </div>
                </Reveal>
              );
            })}

            {viewAllCard && (
              <Reveal
                as="div"
                className="flex basis-[calc(100%/1.5)] flex-none snap-start flex-col items-start justify-between rounded-3xl border border-gray-300 bg-white/60 p-6 text-left transition-all hover:border-gray-500 md:flex-1 md:basis-auto"
                delay={products.length * 80}
              >
                <LocalizedClientLink
                  className="flex h-full w-full flex-col items-start justify-between"
                  href={viewAllCard.href}
                >
                  <div>
                    <p className="font-[700] text-gray-900 text-2xl">
                      {viewAllCard.title}
                      {viewAllCard.subtitle && (
                        <>
                          <br />
                          {viewAllCard.subtitle}
                        </>
                      )}
                    </p>
                  </div>
                  <span className="inline-flex size-12 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900 transition hover:border-[--primary-color] hover:bg-[--primary-color] hover:text-white">
                    <ArrowUpRight className="size-5" />
                  </span>
                </LocalizedClientLink>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
