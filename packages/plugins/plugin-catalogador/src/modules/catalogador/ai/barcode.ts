/**
 * Utilidades de código de barras del Catalogador. Self-contained (no importa
 * otras extensiones — regla del backend autocontenido). La idea de
 * normalización está portada del barcode-scanner del storefront
 * (`api/store/barcode-scanner/match.ts`), acá endurecida con validación de
 * formato GS1 para NO gastar búsquedas externas con SKUs o códigos internos.
 */

type VariantLike = {
  sku?: string | null;
  barcode?: string | null;
  ean?: string | null;
  upc?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Longitudes GS1 válidas: EAN-8, UPC-A, EAN-13, GTIN-14. */
const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/** Trim + quita espacios y guiones. Devuelve null si queda vacío. */
export function normalizeBarcode(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim().replace(/[\s-]+/g, '');
  return normalized.length > 0 ? normalized : null;
}

/** Verifica el dígito de control GS1 (mod-10) para EAN/UPC/GTIN. */
function hasValidCheckDigit(code: string): boolean {
  const digits = code.split('').map((d) => Number(d));
  const check = digits[digits.length - 1] ?? 0;
  const body = digits.slice(0, -1);
  let sum = 0;
  // Desde el dígito más a la derecha del cuerpo, pesos alternos 3,1,3,1...
  for (let i = body.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += (body[i] ?? 0) * weight;
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === check;
}

/**
 * ¿Es un código de barras real (EAN-8/UPC-A/EAN-13/GTIN-14, sólo dígitos y con
 * dígito de control válido)? Los SKUs internos y códigos inventados casi nunca
 * pasan el check digit, así evitamos consumir búsquedas con basura.
 */
export function isValidBarcode(value: unknown): boolean {
  const n = normalizeBarcode(value);
  if (!n) return false;
  if (!/^\d+$/.test(n)) return false;
  if (!GTIN_LENGTHS.has(n.length)) return false;
  return hasValidCheckDigit(n);
}

/**
 * Elige el primer código de barras VÁLIDO del producto, mirando (en orden de
 * prioridad) barcode/ean/upc y varias claves de metadata, y por último el SKU.
 * A diferencia del enriquecimiento previo (que sólo miraba `variant.barcode`),
 * cubre productos cuyo código real vive en `ean`/`metadata`. Devuelve el código
 * NORMALIZADO o null.
 */
export function pickProductBarcode(variants: VariantLike[] | null | undefined): string | null {
  for (const variant of variants ?? []) {
    const meta = (variant.metadata ?? {}) as Record<string, unknown>;
    const candidates = [
      variant.barcode,
      variant.ean,
      variant.upc,
      meta.ean,
      meta.upc,
      meta.barcode,
      meta.gtin,
      variant.sku,
    ];
    for (const candidate of candidates) {
      if (isValidBarcode(candidate)) {
        return normalizeBarcode(candidate);
      }
    }
  }
  return null;
}
