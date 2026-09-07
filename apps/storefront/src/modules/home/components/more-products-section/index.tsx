import { getActiveTenant } from "@lib/site-config/active-tenant";
import type { MoreProductsConfig } from "@lib/site-config/types";
import { getRegion } from "@lib/data/regions";
import { getProductsByIds } from "@lib/data/products";
import Reveal from "@modules/common/components/reveal";
import MoreProductCard from "./more-product-card";
import ViewAllCard from "@modules/home/components/ui/view-all-card";

export default async function MoreProductsSection({
  config: configOverride,
}: {
  /** Config inyectada por el editor del home; fallback a `assets.moreProducts`. */
  config?: MoreProductsConfig;
} = {}) {
  const tenant = await getActiveTenant();
  const config = configOverride ?? tenant.assets.moreProducts;

  if (!config || !config.items?.length) {
    return null;
  }

  const { title = "Conocé más productos", subtitle } = config;

  const region = await getRegion("ar");
  if (!region) {
    return null;
  }

  const productIds = config.items
    .filter((item) => item.productId)
    .map((item) => item.productId!);

  let products: any[] = [];
  if (productIds.length > 0) {
    try {
      products = await getProductsByIds({
        productIds,
        countryCode: "ar",
      });
    } catch (err) {
      // Un blip del backend no debe tumbar la home: las cards se renderizan
      // igual con su config; el producto vinculado es opcional.
      console.error(
        "[MoreProductsSection] product fetch failed, rendering without products:",
        err,
      );
    }
  }

  const itemsWithProducts = config.items.map((item) => {
    const product = item.productId
      ? products.find((p) => p.id === item.productId)
      : null;
    return { item, product };
  });

  return (
    <section className="bg-white py-8">
      <Reveal as="div" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <p className="home-section-heading">{title}</p>
          {subtitle && (
            <p className="mt-1 text-sm font-normal text-gray-500 sm:text-base">
              {subtitle}
            </p>
          )}
        </div>

        <div className="relative">
          <div className="no-scrollbar flex gap-4 overflow-x-auto pb-6">
            {itemsWithProducts.map(({ item, product }, index) => (
              <Reveal
                as="div"
                key={item.categoryId + index}
                delay={index * 60}
                className="w-[160px] flex-shrink-0"
              >
                <MoreProductCard
                  item={item}
                  href={item.href}
                  product={product || undefined}
                  region={region}
                />
              </Reveal>
            ))}

            {config.viewAllCard && (
              <Reveal
                as="div"
                className="w-[160px] flex-shrink-0"
                delay={config.items.length * 60}
              >
                <ViewAllCard
                  href={config.viewAllCard.href}
                  subtitle={config.viewAllCard.subtitle}
                  title={config.viewAllCard.title}
                />
              </Reveal>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
