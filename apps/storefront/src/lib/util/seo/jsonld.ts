/**
 * Builders de JSON-LD (schema.org) para el storefront. Funciones puras que
 * devuelven el objeto del grafo; el render lo hace el componente <JsonLd/>.
 *
 * Habilita el GEO (PRD §10): los datos estructurados son una de las señales que
 * más pesan para que un LLM/buscador entienda y cite el producto. Hasta ahora el
 * storefront no emitía JSON-LD (gap total).
 */

export type JsonLdObject = Record<string, unknown>;

type ProductLike = {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  handle?: string | null;
  thumbnail?: string | null;
  images?: Array<{ url?: string | null }> | null;
  material?: string | null;
  collection?: { title?: string | null } | null;
  variants?: Array<{
    sku?: string | null;
    barcode?: string | null;
    ean?: string | null;
    upc?: string | null;
    calculated_price?: { calculated_amount?: number | null; currency_code?: string | null } | null;
  }> | null;
  metadata?: Record<string, unknown> | null;
};

/** Precio mínimo calculado entre variantes (o null si no hay). */
function minPrice(product: ProductLike): { amount: number; currency: string } | null {
  let best: { amount: number; currency: string } | null = null;
  for (const v of product.variants ?? []) {
    const amount = v.calculated_price?.calculated_amount;
    const currency = v.calculated_price?.currency_code;
    if (typeof amount === 'number' && currency) {
      if (!best || amount < best.amount) best = { amount, currency };
    }
  }
  return best;
}

function firstGtin(product: ProductLike): string | null {
  for (const v of product.variants ?? []) {
    const g = v.barcode || v.ean || v.upc;
    if (g) return g;
  }
  return null;
}

/** schema.org/Product con offers cuando hay precio (PRD §10 comparabilidad/datos). */
export function buildProductJsonLd(product: ProductLike, url: string, brand?: string | null): JsonLdObject {
  const images = (product.images ?? [])
    .map((i) => i?.url)
    .filter((u): u is string => Boolean(u));
  if (product.thumbnail && !images.includes(product.thumbnail)) images.unshift(product.thumbnail);

  const price = minPrice(product);
  const gtin = firstGtin(product);
  const sku = product.variants?.find((v) => v.sku)?.sku ?? undefined;
  const brandName =
    brand ||
    (typeof product.metadata?.brand === 'string' ? (product.metadata.brand as string) : undefined) ||
    (typeof product.metadata?.marca === 'string' ? (product.metadata.marca as string) : undefined);

  const node: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    url,
    ...(product.description ? { description: stripHtml(product.description) } : {}),
    ...(images.length ? { image: images } : {}),
    ...(sku ? { sku } : {}),
    ...(gtin ? { gtin } : {}),
    ...(product.material ? { material: product.material } : {}),
    ...(brandName ? { brand: { '@type': 'Brand', name: brandName } } : {}),
  };

  if (price) {
    node.offers = {
      '@type': 'Offer',
      url,
      priceCurrency: price.currency.toUpperCase(),
      price: (price.amount ?? 0).toString(),
      availability: 'https://schema.org/InStock',
    };
  }

  return node;
}

export type BreadcrumbItem = { name: string; url: string };

/** schema.org/BreadcrumbList a partir de una ruta de migas. */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

/**
 * schema.org/CollectionPage para las páginas de LISTADO (tienda, colección, categoría
 * del blog).
 *
 * Son las que la auditoría del 19/08 levantó como `missing-structured-data`: 37 de 57
 * páginas no emitían nada, porque sólo la home y la PDP montaban `<JsonLd/>`.
 *
 * A propósito NO incluye `ItemList` con los productos: el listado se renderiza
 * client-side contra Typesense, así que el server no los tiene y declararlos exigiría
 * traerlos de nuevo en la página. El `ItemList` llega junto con la página de categoría
 * server-side; esto cubre la identidad del listado, que es lo que falta hoy.
 */
export function buildCollectionPageJsonLd(opts: {
  name: string;
  url: string;
  description?: string | null;
}): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.name,
    url: opts.url,
    ...(opts.description ? { description: opts.description } : {}),
  };
}

/** schema.org/Organization (identidad de la tienda) para la home. */
export function buildOrganizationJsonLd(opts: { name: string; url: string; logo?: string | null }): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: opts.name,
    url: opts.url,
    ...(opts.logo ? { logo: opts.logo } : {}),
  };
}

/** schema.org/FAQPage a partir de pares pregunta/respuesta. */
export function buildFaqJsonLd(faqs: Array<{ question: string; answer: string }>): JsonLdObject | null {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

/** Extrae FAQ de metadata.faq(s) si viene como array [{question,answer}] o {q:a}. */
export function faqsFromMetadata(metadata: Record<string, unknown> | null | undefined): Array<{ question: string; answer: string }> {
  const raw = metadata?.faq ?? metadata?.faqs ?? metadata?.preguntas_frecuentes;
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(arr)) {
      return arr
        .map((x) => ({
          question: String((x as Record<string, unknown>).question ?? (x as Record<string, unknown>).q ?? ''),
          answer: String((x as Record<string, unknown>).answer ?? (x as Record<string, unknown>).a ?? ''),
        }))
        .filter((f) => f.question && f.answer);
    }
    if (arr && typeof arr === 'object') {
      return Object.entries(arr as Record<string, unknown>).map(([q, a]) => ({ question: q, answer: String(a) }));
    }
  } catch {
    // metadata mal formada: sin FAQ
  }
  return [];
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
