import type { StorefrontBundleItem, StorefrontVariant } from "@lib/data/bundles";

/**
 * Capa de presentación del wizard: traduce lo que el catálogo trae (producto,
 * variante y metadata) a lo que la UI necesita mostrar — pregunta del paso,
 * foto por variante, etiqueta de gama y detalle.
 *
 * El backend de bundles (`GET /store/bundles/:handle`) devuelve un subconjunto
 * mínimo del producto: ni descripción, ni galería, ni `variants.metadata`. Esa
 * información llega desde `/store/products` (ver `page.tsx`) y se inyecta acá
 * como `BundleProductEnrichment`. Cuando falta, todo cae a la thumbnail del
 * producto y la UI sigue funcionando.
 */

export interface BundleVariantEnrichment {
  /** `variant.metadata` tal cual lo devuelve la Store API. */
  metadata: Record<string, unknown> | null;
}

export interface BundleProductEnrichment {
  description: string | null;
  subtitle: string | null;
  /** Galería del producto, en orden de rank. */
  images: string[];
  metadata: Record<string, unknown> | null;
  /** variant_id → metadata de la variante. */
  variants: Record<string, BundleVariantEnrichment>;
}

export type BundleEnrichment = Record<string, BundleProductEnrichment>;

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

/** Gamas conocidas. El orden es el que la lista escolar usa para ordenar las opciones. */
const TIER_ORDER: Record<string, number> = { economica: 0, intermedia: 1, premium: 2 };

export interface VariantPresentation {
  id: string;
  /** Nombre corto para la tarjeta: la marca/modelo, no el título del producto. */
  label: string;
  /** "Económica" | "Intermedia" | "Premium" — badge de la tarjeta. Null si no hay gama. */
  tierLabel: string | null;
  tierRank: number;
  marca: string | null;
  codigo: string | null;
  detalle: string | null;
  image: string | null;
  amount: number | null;
  currencyCode: string | null;
}

export const describeVariant = (
  variant: StorefrontVariant,
  product: { thumbnail: string | null },
  enrichment?: BundleProductEnrichment,
): VariantPresentation => {
  const meta = enrichment?.variants[variant.id]?.metadata ?? null;
  const tier = str(meta?.tier);
  return {
    id: variant.id,
    label: variant.title ?? str(meta?.marca) ?? "Opción",
    tierLabel: str(meta?.tier_label),
    tierRank: tier ? (TIER_ORDER[tier] ?? 99) : 99,
    marca: str(meta?.marca),
    codigo: str(meta?.codigo),
    detalle: str(meta?.detalle),
    // Medusa no tiene imagen por variante: la convención del catálogo es
    // `variant.metadata.image`. Sin ella caemos a la galería del producto (por
    // posición) y finalmente a la thumbnail.
    image: str(meta?.image) ?? null,
    amount: variant.calculated_price?.amount ?? null,
    currencyCode: variant.calculated_price?.currency_code ?? null,
  };
};

/**
 * Resuelve la foto de cada variante garantizando que no se repita mientras haya
 * imágenes disponibles: primero `metadata.image`, después la galería del
 * producto por posición y, como último recurso, la thumbnail.
 */
export const describeVariants = (
  variants: StorefrontVariant[],
  product: { thumbnail: string | null },
  enrichment?: BundleProductEnrichment,
): VariantPresentation[] => {
  const gallery = enrichment?.images ?? [];
  const taken = new Set(
    variants
      .map((v) => str(enrichment?.variants[v.id]?.metadata?.image))
      .filter((url): url is string => !!url),
  );
  let cursor = 0;
  return variants.map((variant) => {
    const described = describeVariant(variant, product, enrichment);
    if (!described.image) {
      while (cursor < gallery.length && taken.has(gallery[cursor]!)) cursor += 1;
      described.image = gallery[cursor] ?? product.thumbnail ?? null;
      if (gallery[cursor]) {
        taken.add(gallery[cursor]!);
        cursor += 1;
      }
    }
    return described;
  });
};

/**
 * Cada paso es una pregunta (no una lista). Cuando el producto viene de una
 * lista escolar usamos el artículo tal como lo pidió el colegio; si no, el
 * título del producto.
 */
export const stepQuestion = (
  item: StorefrontBundleItem,
  enrichment?: BundleProductEnrichment,
): { question: string; requested: string | null } => {
  const requested = str(enrichment?.metadata?.articulo_solicitado);
  const name = requested ?? item.product?.title ?? "este producto";
  // El artículo de la lista trae la especificación entre paréntesis ("(48
  // hojas, violeta)") y a veces un separador. En el título queda ilegible, así
  // que la pregunta usa el nombre corto y la especificación completa baja al
  // subtítulo — donde el comprador la necesita para chequear que sea lo pedido.
  const short = name.replace(/\s*\([^)]*\)/g, "").replace(/\s*·.*$/, "").trim();
  return {
    question: `¿Cuál elegís para ${lowerFirst(short || name)}?`,
    // Sin repetir: si la versión corta ya dice todo, no mostramos el pedido.
    requested: requested && requested !== short ? requested : null,
  };
};

const lowerFirst = (value: string): string =>
  value.length > 1 && value.slice(1) !== value.slice(1).toUpperCase()
    ? value[0]!.toLowerCase() + value.slice(1)
    : value;

/** Galería a mostrar en el detalle de una variante: su foto primero, sin repetidos. */
export const detailGallery = (
  presentation: VariantPresentation,
  enrichment?: BundleProductEnrichment,
  fallback?: string | null,
): string[] => {
  const urls = [presentation.image, ...(enrichment?.images ?? []), fallback].filter(
    (url): url is string => !!url,
  );
  // `Array.from` y no spread: el tsconfig del storefront compila a un target
  // sin iteración de `Set` (TS2802), y el spread no pasa el typecheck de CI.
  return Array.from(new Set(urls));
};
