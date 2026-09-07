import type { HttpTypes } from "@medusajs/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";

type ProductInfoProps = {
  product: HttpTypes.StoreProduct;
};

const ProductInfo = ({ product }: ProductInfoProps) => {
  const breadcrumbs = buildBreadcrumbs(product);

  return (
    <div id="product-info">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav className="mb-3 hidden lg:block" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
            <li>
              <LocalizedClientLink
                href="/store"
                className="hover:text-[--primary-color]"
              >
                Tienda
              </LocalizedClientLink>
            </li>
            {breadcrumbs.map((crumb, idx) => (
              <li key={idx} className="flex items-center gap-1">
                <span>/</span>
                {crumb.href ? (
                  <LocalizedClientLink
                    href={crumb.href}
                    className="hover:text-[--primary-color]"
                  >
                    {crumb.label}
                  </LocalizedClientLink>
                ) : (
                  <span className="text-gray-700 last:font-semibold">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {product.categories && product.categories.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {product.categories.map((cat, index) =>
            cat.handle || cat.name ? (
              <LocalizedClientLink
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-[--primary-color] hover:text-white"
                // El filtro de la tienda usa el NOMBRE de la categoría (no el
                // handle/slug): ?category= se parsea como lista de nombres
                // separados por coma. Usar el handle caía en "sin productos".
                href={`/store?category=${encodeURIComponent(cat.name || cat.handle || "")}`}
                key={cat.id}
              >
                {cat.name || cat.handle}
              </LocalizedClientLink>
            ) : (
              <span
                className="cursor-default rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-400"
                key={`${cat.id}${index}`}
              >
                {cat.id}
              </span>
            ),
          )}
        </div>
      )}

      <h1
        className="font-bold text-2xl text-gray-900 tracking-tight lg:text-3xl"
        data-testid="product-title"
      >
        {product.title}
      </h1>

      {/* El catalogador escribe `subtitle` (el claim corto del producto) y hasta
          acá la PDP no lo pintaba en ningún lado: sólo aparecía como relleno de
          la meta description compuesta. */}
      {product.subtitle && (
        <p
          className="mt-1.5 text-base text-gray-600 lg:text-lg"
          data-testid="product-subtitle"
        >
          {product.subtitle}
        </p>
      )}
    </div>
  );
};

function buildBreadcrumbs(product: HttpTypes.StoreProduct) {
  const crumbs: { label: string; href?: string }[] = [];

  if (product.collection) {
    crumbs.push({
      label: product.collection.title ?? "",
      href: `/collections/${product.collection.handle}`,
    });
  }

  if (product.categories && product.categories.length > 0) {
    const category = product.categories[product.categories.length - 1];
    if (category) {
      crumbs.push({
        label: category.name ?? "",
        href: `/store?category=${encodeURIComponent(category.name ?? "")}`,
      });
    }
  }

  crumbs.push({ label: product.title ?? "" });

  return crumbs;
}

export default ProductInfo;
