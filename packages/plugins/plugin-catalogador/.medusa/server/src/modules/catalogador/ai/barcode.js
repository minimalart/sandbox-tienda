"use strict";
/**
 * Utilidades de código de barras del Catalogador. Self-contained (no importa
 * otras extensiones — regla del backend autocontenido). La idea de
 * normalización está portada del barcode-scanner del storefront
 * (`api/store/barcode-scanner/match.ts`), acá endurecida con validación de
 * formato GS1 para NO gastar búsquedas externas con SKUs o códigos internos.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBarcode = normalizeBarcode;
exports.isValidBarcode = isValidBarcode;
exports.pickProductBarcode = pickProductBarcode;
/** Longitudes GS1 válidas: EAN-8, UPC-A, EAN-13, GTIN-14. */
const GTIN_LENGTHS = new Set([8, 12, 13, 14]);
/** Trim + quita espacios y guiones. Devuelve null si queda vacío. */
function normalizeBarcode(value) {
    if (typeof value !== 'string' && typeof value !== 'number')
        return null;
    const normalized = String(value).trim().replace(/[\s-]+/g, '');
    return normalized.length > 0 ? normalized : null;
}
/** Verifica el dígito de control GS1 (mod-10) para EAN/UPC/GTIN. */
function hasValidCheckDigit(code) {
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
function isValidBarcode(value) {
    const n = normalizeBarcode(value);
    if (!n)
        return false;
    if (!/^\d+$/.test(n))
        return false;
    if (!GTIN_LENGTHS.has(n.length))
        return false;
    return hasValidCheckDigit(n);
}
/**
 * Elige el primer código de barras VÁLIDO del producto, mirando (en orden de
 * prioridad) barcode/ean/upc y varias claves de metadata, y por último el SKU.
 * A diferencia del enriquecimiento previo (que sólo miraba `variant.barcode`),
 * cubre productos cuyo código real vive en `ean`/`metadata`. Devuelve el código
 * NORMALIZADO o null.
 */
function pickProductBarcode(variants) {
    for (const variant of variants ?? []) {
        const meta = (variant.metadata ?? {});
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFyY29kZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL2FpL2JhcmNvZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFjSCw0Q0FJQztBQXFCRCx3Q0FNQztBQVNELGdEQW9CQztBQWhFRCw2REFBNkQ7QUFDN0QsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBRTlDLHFFQUFxRTtBQUNyRSxTQUFnQixnQkFBZ0IsQ0FBQyxLQUFjO0lBQzdDLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVE7UUFBRSxPQUFPLElBQUksQ0FBQztJQUN4RSxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUMvRCxPQUFPLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNuRCxDQUFDO0FBRUQsb0VBQW9FO0FBQ3BFLFNBQVMsa0JBQWtCLENBQUMsSUFBWTtJQUN0QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzdDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQ1oseUVBQXlFO0lBQ3pFLEtBQUssSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLE1BQU0sR0FBRyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3JGLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUM7SUFDakMsQ0FBQztJQUNELE1BQU0sUUFBUSxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ3hDLE9BQU8sUUFBUSxLQUFLLEtBQUssQ0FBQztBQUM1QixDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQWdCLGNBQWMsQ0FBQyxLQUFjO0lBQzNDLE1BQU0sQ0FBQyxHQUFHLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2xDLElBQUksQ0FBQyxDQUFDO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDckIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDbkMsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzlDLE9BQU8sa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL0IsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILFNBQWdCLGtCQUFrQixDQUFDLFFBQTBDO0lBQzNFLEtBQUssTUFBTSxPQUFPLElBQUksUUFBUSxJQUFJLEVBQUUsRUFBRSxDQUFDO1FBQ3JDLE1BQU0sSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQTRCLENBQUM7UUFDakUsTUFBTSxVQUFVLEdBQUc7WUFDakIsT0FBTyxDQUFDLE9BQU87WUFDZixPQUFPLENBQUMsR0FBRztZQUNYLE9BQU8sQ0FBQyxHQUFHO1lBQ1gsSUFBSSxDQUFDLEdBQUc7WUFDUixJQUFJLENBQUMsR0FBRztZQUNSLElBQUksQ0FBQyxPQUFPO1lBQ1osSUFBSSxDQUFDLElBQUk7WUFDVCxPQUFPLENBQUMsR0FBRztTQUNaLENBQUM7UUFDRixLQUFLLE1BQU0sU0FBUyxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ25DLElBQUksY0FBYyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7Z0JBQzlCLE9BQU8sZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDckMsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIn0=