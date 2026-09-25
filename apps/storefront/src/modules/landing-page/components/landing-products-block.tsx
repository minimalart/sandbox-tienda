import { searchTypesenseProducts } from '@lib/typesense';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import CompactProductCard from '@modules/home/components/featured-products-grid/compact-product-card';
import { Button } from '@/components/ui/button';

type ProductsSource =
  | 'category'
  | 'collection'
  | 'tag'
  | 'promotions'
  | 'newest'
  | 'query';

type SearchParams = Parameters<typeof searchTypesenseProducts>[0];

export type LandingProductsBlockProps = {
  heading?: string;
  source?: ProductsSource;
  /** Nombre de categoría/colección, tag o texto de búsqueda según `source`. */
  value?: string;
  limit?: number;
  sortBy?: SearchParams['sortBy'];
  ctaLabel?: string;
  href?: string;
  /** Colores opcionales elegidos en Puck (vacío = color por defecto del tema). */
  background?: string;
  textColor?: string;
  /** Inyectado por el renderer; necesario para las cards. */
  countryCode?: string;
  previewLanguage?: 'es' | 'en';
};

const wrap = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8';

/**
 * Bloque de landing que trae productos REALES de Typesense (server-side, igual
 * que las secciones de la home) y los muestra como cards. Configurable desde
 * Puck: qué traer (categoría/colección/tag/promos/novedades/búsqueda) y cuántos.
 * Falla en silencio (no rompe la landing) si Typesense no responde.
 */
export default async function LandingProductsBlock({
  heading,
  source = 'newest',
  value,
  limit = 8,
  sortBy,
  ctaLabel,
  href,
  background,
  textColor,
  countryCode = 'ar',
  previewLanguage,
}: LandingProductsBlockProps) {
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 24);
  const params: SearchParams = {
    limit: safeLimit,
    sortBy: sortBy || (source === 'newest' ? 'created_at' : undefined),
  };

  const v = value?.trim();
  switch (source) {
    case 'category':
      if (v) params.category = v;
      break;
    case 'collection':
      if (v) params.collection = v;
      break;
    case 'tag':
      if (v) params.tag = v;
      break;
    case 'promotions':
      params.onlyPromotions = true;
      break;
    case 'query':
      if (v) params.q = v;
      break;
    default:
      break;
  }

  let products: Awaited<ReturnType<typeof searchTypesenseProducts>>['products'] = [];
  try {
    const result = await searchTypesenseProducts(params, { track: !previewLanguage });
    products = result.products;
  } catch (err) {
    console.error('[LandingProductsBlock] Typesense fetch failed:', err);
    if (previewLanguage) return <p role="alert" className={`${wrap} py-8`}>
      {previewLanguage === 'es' ? 'No se pudo cargar el catálogo. Revisá la conexión de búsqueda de esta tienda.' : 'The catalog could not be loaded. Check this store’s search connection.'}
    </p>;
    return null;
  }

  if (!products.length) return previewLanguage ? <p className={`${wrap} py-8`}>
    {previewLanguage === 'es' ? 'Este filtro no tiene productos visibles en la tienda seleccionada.' : 'This filter has no visible products in the selected store.'}
  </p> : null;

  return (
    <section
      className={`${wrap} py-8`}
      style={background ? { backgroundColor: background } : undefined}
    >
      {heading ? (
        <h2
          className="mb-6 font-semibold text-2xl text-gray-900"
          style={textColor ? { color: textColor } : undefined}
        >
          {heading}
        </h2>
      ) : null}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <CompactProductCard
            key={product.id}
            product={product}
            countryCode={countryCode}
          />
        ))}
      </div>
      {ctaLabel && href ? (
        <div className="mt-8 text-center">
          <Button asChild size="storefront" variant="storefrontOutline">
            <LocalizedClientLink href={href}>{ctaLabel}</LocalizedClientLink>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
