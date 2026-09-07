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
/** Trim + quita espacios y guiones. Devuelve null si queda vacío. */
export declare function normalizeBarcode(value: unknown): string | null;
/**
 * ¿Es un código de barras real (EAN-8/UPC-A/EAN-13/GTIN-14, sólo dígitos y con
 * dígito de control válido)? Los SKUs internos y códigos inventados casi nunca
 * pasan el check digit, así evitamos consumir búsquedas con basura.
 */
export declare function isValidBarcode(value: unknown): boolean;
/**
 * Elige el primer código de barras VÁLIDO del producto, mirando (en orden de
 * prioridad) barcode/ean/upc y varias claves de metadata, y por último el SKU.
 * A diferencia del enriquecimiento previo (que sólo miraba `variant.barcode`),
 * cubre productos cuyo código real vive en `ean`/`metadata`. Devuelve el código
 * NORMALIZADO o null.
 */
export declare function pickProductBarcode(variants: VariantLike[] | null | undefined): string | null;
export {};
