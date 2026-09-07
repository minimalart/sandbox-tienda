/**
 * Entrada normalizada del scoring GEO: el subconjunto de datos de un producto
 * que las heurísticas necesitan. Se extrae de `query.graph` (ver load-products),
 * pero el scoring es una función pura sobre este tipo → testeable sin Medusa.
 */
export type GeoProductInput = {
  id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  material: string | null;
  weight: number | null;
  length: number | null;
  height: number | null;
  width: number | null;
  tags: string[];
  categories: string[];
  collection: string | null;
  type: string | null;
  brand: string | null;
  variants: Array<{ sku: string | null; barcode: string | null; ean: string | null; upc: string | null }>;
  /** Títulos de opciones (ej. "Color", "Talle") — señal de comparabilidad. */
  option_titles: string[];
  images_count: number;
  images_with_alt: number;
  /** Claves de metadata custom (atributos). */
  metadata_keys: string[];
  /** Hay FAQ declarada (metadata.faq / campo dedicado). */
  has_faq: boolean;
};

/** Resultado del scoring de un producto (0-100 por dimensión + flags). */
export type GeoProductResult = {
  product_id: string;
  score: number;
  comprehension: number;
  coverage: number;
  authority: number;
  comparability: number;
  structured_data: number;
  depth: number;
  has_use_cases: boolean;
  has_materials: boolean;
  is_comparable: boolean;
  has_faq: boolean;
  has_benefits: boolean;
  has_compatibilities: boolean;
  signals: Record<string, unknown>;
};
