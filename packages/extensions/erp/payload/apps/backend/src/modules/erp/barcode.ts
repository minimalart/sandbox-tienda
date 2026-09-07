/**
 * Validación de códigos de barras que llegan del ERP.
 *
 * El campo del ERP donde vive el código de barras suele ser una nota de texto
 * libre (en Zeus es `nota2`), así que puede traer cualquier cosa: un EAN real, un
 * comentario del vendedor, una referencia interna o basura. Y el destino es
 * `variant.barcode`, que es el campo que lee el escáner del checkout: un valor
 * inventado ahí no falla ruidosamente, hace que un producto no se encuentre al
 * escanearlo.
 *
 * Por eso se valida de verdad (largo + dígito verificador GS1) y lo que no pasa
 * se descarta con motivo, en lugar de copiarse. Es la fila "Código de barras" de
 * la política del cron acordada con el cliente: actualizar solo cuando está
 * presente y es válido, conservar el último válido, y dejar warning.
 */

export type BarcodeCheck =
  | { value: string; format: 'EAN-8' | 'UPC-A' | 'EAN-13' | 'GTIN-14' }
  | { value: null; reason: string | null };

/** Largo → nombre del formato GTIN. Son los cuatro que define GS1. */
const FORMATS: Record<number, 'EAN-8' | 'UPC-A' | 'EAN-13' | 'GTIN-14'> = {
  8: 'EAN-8',
  12: 'UPC-A',
  13: 'EAN-13',
  14: 'GTIN-14',
};

/**
 * Dígito verificador GS1 (mod 10): de derecha a izquierda sin el último dígito,
 * se pesa 3,1,3,1… y el verificador es lo que falta para el múltiplo de 10.
 * Sirve para los cuatro largos por igual.
 */
function hasValidCheckDigit(digits: string): boolean {
  const body = digits.slice(0, -1);
  const expected = Number(digits.at(-1));
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    // El dígito más a la derecha del cuerpo pesa 3.
    const weight = (body.length - 1 - i) % 2 === 0 ? 3 : 1;
    sum += Number(body[i]) * weight;
  }
  return (10 - (sum % 10)) % 10 === expected;
}

/**
 * Códigos que más de un artículo del ERP reclama, con la lista de artículos.
 *
 * Un GTIN identifica UN producto, así que compartirlo es un error de carga en el
 * ERP — y no es teórico: en la cuenta real dos códigos estaban en 5 artículos
 * cada uno, de marcas distintas (`7790400021806` en C/40, C28, C67, CM/40 y
 * COL1). Medusa además tiene constraint único en `variant.barcode`, así que el
 * segundo write revienta con "already exists".
 *
 * El formato no alcanza para detectarlo: los duplicados son EAN-13 perfectamente
 * válidos. Hace falta mirar el lote entero, y por eso vive acá y no en
 * `checkBarcode`.
 */
export function findDuplicateBarcodes(
  rows: Array<{ code: string; barcode?: string | null }>
): Map<string, string[]> {
  const byBarcode = new Map<string, string[]>();
  for (const row of rows) {
    const barcode = row.barcode?.trim();
    if (!barcode) continue;
    const bucket = byBarcode.get(barcode) ?? [];
    bucket.push(row.code);
    byBarcode.set(barcode, bucket);
  }
  for (const [barcode, codes] of byBarcode) {
    if (codes.length < 2) byBarcode.delete(barcode);
  }
  return byBarcode;
}

/**
 * Devuelve el código listo para escribir, o `null` con el motivo. Tolera los
 * separadores con los que se cargan a mano (espacios, guiones, puntos) porque son
 * de presentación, no parte del código.
 *
 * `reason` es `null` cuando el campo simplemente venía vacío: eso no es un error
 * y no tiene que generar warning para la mayoría del catálogo.
 */
export function checkBarcode(raw: unknown): BarcodeCheck {
  if (raw === null || raw === undefined) return { value: null, reason: null };
  const text = String(raw).trim();
  if (!text) return { value: null, reason: null };

  const digits = text.replace(/[\s.\-_]/g, '');
  if (!/^\d+$/.test(digits)) {
    return { value: null, reason: `"${text}" no es un código de barras (tiene caracteres no numéricos).` };
  }

  const format = FORMATS[digits.length];
  if (!format) {
    return {
      value: null,
      reason: `"${text}" tiene ${digits.length} dígitos; un GTIN válido tiene 8, 12, 13 o 14.`,
    };
  }
  if (!hasValidCheckDigit(digits)) {
    return { value: null, reason: `"${text}" no pasa el dígito verificador de un ${format}.` };
  }
  return { value: digits, format };
}
