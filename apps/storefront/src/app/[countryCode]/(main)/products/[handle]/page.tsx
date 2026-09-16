import { getChannelProductByHandle } from "@lib/data/channel-products";
import { getRegion } from "@lib/data/regions";
/**
 * `getActiveTenant()` y NO `getTenant()`.
 *
 * `getTenant()` es el resolver ESTÁTICO: devuelve `defaultConfig` (`site-config/default.ts`),
 * cuyo `name` es el literal `"Mercatto"` del boilerplate. El root layout ya usa
 * `getActiveTenant()` —el que lee la fila del sitio— y por eso el `<title>` de desdeelsur
 * decía "Desde el sur" mientras ESTA página seguía emitiendo, en cada PDP:
 *
 *   - `BreadcrumbList` con `{ "name": "Mercatto", "item": "…/" }` como raíz;
 *   - la meta description de fallback "Comprá online en Mercatto…" para todo producto
 *     sin descripción propia del catalogador.
 *
 * Structured data con la marca de otra tienda no es un detalle de copy: es lo que Google
 * lee como identidad del sitio (DESDEELSUR-50). `getActiveTenant()` está documentado como
 * drop-in replacement de `getTenant()` justamente para esto, y cae a `getTenant()` solo si
 * la fila no está.
 */
import { usesQuickViewOnly } from "@lib/site-config/template-helpers";
import { getActiveTenant } from "@lib/site-config/active-tenant";
import { canonicalUrl } from "@lib/util/site-url";
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildProductJsonLd,
  faqsFromMetadata,
} from "@lib/util/seo/jsonld";
import {
  pickMetaDescription,
  productSeoFromMetadata,
} from "@lib/util/seo/product-metadata";
import JsonLd from "@modules/common/components/json-ld";
import ProductTemplate from "@modules/products/templates";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ countryCode: string; handle: string }>;
};

/** URL canónica absoluta de la PDP (sin el segmento de país para no duplicar). */
const productCanonical = (handle: string) => canonicalUrl(`/products/${handle}`);

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const [product, tenant] = await Promise.all([
    getChannelProductByHandle(params.handle, params.countryCode, true),
    getActiveTenant(),
  ]);

  if (!product || usesQuickViewOnly(tenant.template)) {
    notFound();
  }

  // Textos que la extensión "catalogador" aplica en `product.metadata`. Se generaban
  // y se guardaban bien, pero esta página los ignoraba por completo: armaba title y
  // description a mano y el SEO curado por IA no llegaba nunca al HTML.
  const seo = productSeoFromMetadata(
    product.metadata as Record<string, unknown> | null,
  );

  // SIN ` | ${tenant.name}`: el `title.template` del root layout YA agrega la marca, así
  // que esto emitía `Producto | Mercatto | Mercatto` (7 grupos de `duplicate-title` en la
  // auditoría del 19/08, uno por cada par de productos que comparten título).
  // El `meta_title` del catalogador entra por el mismo lugar y hereda el template: NO
  // debe traer la marca tampoco (si la trae, vuelve el duplicado).
  const title = seo.metaTitle || product.title;
  /**
   * Descripción: si el producto no trae una, se COMPONE con lo que sí hay.
   *
   * `product.title` pelado dejaba 27 páginas con `meta-description-too-short` (el mínimo
   * son 70 caracteres) y, peor, con la descripción idéntica al título — que para Google
   * es como no tener descripción.
   *
   * `pickMetaDescription` aplica ese piso de 70 a los dos candidatos reales
   * (`meta_description` primero, `description` después) y cae a la compuesta cuando
   * ninguno llega: un `meta_description` corto NO puede tirar abajo el fallback.
   */
  const composedDescription = [
    product.title,
    product.subtitle,
    product.collection?.title ? `Línea ${product.collection.title}` : null,
    `Comprá online en ${tenant.name} con stock disponible y envíos a domicilio.`,
  ]
    .filter(Boolean)
    .join(". ");
  const description = pickMetaDescription(
    [seo.metaDescription, product.description],
    composedDescription,
  );

  return {
    title,
    description,
    // Sin keywords no se emite la meta: una `<meta name="keywords">` vacía es peor
    // que no tenerla.
    ...(seo.keywords.length ? { keywords: seo.keywords } : {}),
    alternates: { canonical: await productCanonical(params.handle) },
    openGraph: {
      title,
      description,
      images: product.thumbnail ? [product.thumbnail] : [],
    },
  };
}

export default async function ProductPage(props: Props) {
  const params = await props.params;
  const region = await getRegion(params.countryCode);

  if (!region) {
    notFound();
  }

  const [product, tenant] = await Promise.all([
    getChannelProductByHandle(params.handle, params.countryCode, true),
    getActiveTenant(),
  ]);

  if (!product || usesQuickViewOnly(tenant.template)) {
    notFound();
  }

  // Mismas URLs que el `<link rel="canonical">`: las arma `canonicalUrl()`, que ya
  // resuelve origen canónico + prefijo de tienda y está memoizada por request.
  const [canonicalBase, url] = await Promise.all([
    canonicalUrl("/"),
    productCanonical(params.handle),
  ]);
  const faqs = faqsFromMetadata(product.metadata as Record<string, unknown> | null);
  const jsonLd = [
    buildProductJsonLd(product as never, url),
    buildBreadcrumbJsonLd([
      { name: tenant.name, url: canonicalBase },
      ...(product.collection?.title
        ? [{ name: product.collection.title, url: await canonicalUrl(`/collections/${product.collection.handle ?? ""}`) }]
        : []),
      { name: product.title, url },
    ]),
    buildFaqJsonLd(faqs),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <ProductTemplate
        countryCode={params.countryCode}
        product={product}
        region={region}
      />
    </>
  );
}
