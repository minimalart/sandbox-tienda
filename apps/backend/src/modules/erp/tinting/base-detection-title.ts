/**
 * De qué título se detecta una base entonable.
 *
 * El detector parsea `… BASE F X 3,6 LTS`, y la regla **R26** del normalizador
 * de títulos (`sync/product-title.ts`) saca justamente eso: `BASE F X 3,6 LTS`
 * queda en `x4 lt`, sin el `Base F`. Las dos reglas son correctas por separado y
 * juntas se anulan — una base que entró por el catalog sync tiene el título ya
 * normalizado, `parseTintingBase` no encuentra `BASE` y la base NUNCA se
 * detecta. Como `bases/sync-products` además la saltea por `already_in_medusa`,
 * el artículo queda invisible para el tintométrico para siempre.
 *
 * Es el estado real de los artículos de desdeelsur 734, 744-749, 755-756,
 * 765-770, 993, 999, 710, 712 y 713: están publicados, son bases, y el PDP
 * responde `tintable: false`.
 *
 * El título crudo lo guarda el propio sync en la metadata de la variante
 * (`erpVariantMetadata` → `zeus_source_title`), así que la salida es leerlo de
 * ahí. Se cae al título del producto cuando no está: las variantes anteriores a
 * la normalización no lo tienen, y ésas conservan el `BASE` en el título.
 */

/** Claves donde el sync deja el título tal como lo mandó el ERP. */
const SOURCE_TITLE_KEYS = ['zeus_source_title', 'source_title'] as const;

export type BaseDetectionCandidate = {
  /** Metadata de la VARIANTE: es donde el sync escribe el título crudo. */
  metadata?: unknown;
  title?: string | null;
  product?: { title?: string | null } | null;
};

/** El título crudo del ERP guardado en la metadata, o `null`. */
export function sourceTitleOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const record = metadata as Record<string, unknown>;
  for (const key of SOURCE_TITLE_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * El título con el que hay que intentar detectar la base.
 *
 * Precedencia: crudo del ERP → título del producto → título de la variante. El
 * del producto va antes que el de la variante porque la variante suele decir
 * "Único" o el envase, no la línea.
 */
export function baseDetectionTitle(variant: BaseDetectionCandidate): string {
  return (
    sourceTitleOf(variant.metadata) ??
    variant.product?.title?.trim() ??
    variant.title?.trim() ??
    ''
  );
}
