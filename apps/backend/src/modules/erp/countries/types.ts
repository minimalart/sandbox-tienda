import type { ErpFiscalDocument } from '../types';

/**
 * Capa país: concentra las diferencias fiscales/locales (moneda, tipos de
 * documento, normalizaciones) para que los adapters no queden acoplados a un
 * país. En el MVP es liviana, pero existe desde el diseño para que
 * Contabilium≠Argentina.
 */
export interface CountryLayer {
  readonly code: string;
  readonly currency: string;
  readonly documentTypes: readonly string[];
  /**
   * Extrae el documento fiscal del comprador desde la orden (en AR:
   * `metadata.billing_snapshot`). Devuelve `{null, null}` si no hay documento
   * válido (consumidor final).
   */
  inferDocument(order: { metadata?: Record<string, unknown> | null }): ErpFiscalDocument;
  validateDocument(type: string, number: string): boolean;
  normalizePhone(phone: string | null | undefined): string | null;
  normalizePostalCode(postal: string | null | undefined): string | null;
}
