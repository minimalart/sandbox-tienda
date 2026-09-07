import type { ErpFiscalDocument } from '../types';
import type { CountryLayer } from './types';

/**
 * Capa país Chile: CLP y RUT como documento fiscal. El RUT se valida con el
 * checksum real (módulo 11 con dígito K), no solo formato, y se normaliza al
 * canónico `XXXXXXXX-D` sin puntos — el formato que espera Bsale en
 * `client.code` (aec-chile-backend compara `code.replaceAll('.','')`).
 */

/** Separa cuerpo y dígito verificador de un RUT en cualquier formato. */
export function cleanRut(raw: string): { body: string; dv: string } | null {
  const compact = raw.replace(/[.\s-]/g, '').toUpperCase();
  if (compact.length < 2) return null;
  const body = compact.slice(0, -1);
  const dv = compact.slice(-1);
  if (!/^\d+$/.test(body)) return null;
  if (!/^[\dK]$/.test(dv)) return null;
  return { body, dv };
}

/** Dígito verificador módulo 11 (factores 2..7 desde la derecha): '0'-'9' o 'K'. */
export function computeRutDv(body: string): string {
  let factor = 2;
  let sum = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const mod = 11 - (sum % 11);
  if (mod === 11) return '0';
  if (mod === 10) return 'K';
  return String(mod);
}

/** Checksum completo. Exige cuerpo de 6 a 9 dígitos (RUTs reales). */
export function isValidRut(raw: string): boolean {
  const parts = cleanRut(raw);
  if (!parts) return false;
  if (parts.body.length < 6 || parts.body.length > 9) return false;
  return computeRutDv(parts.body) === parts.dv;
}

/** Normaliza al canónico `XXXXXXXX-D` (sin puntos, K mayúscula) o `null` si es inválido. */
export function formatRut(raw: string): string | null {
  if (!isValidRut(raw)) return null;
  const parts = cleanRut(raw)!;
  return `${parts.body}-${parts.dv}`;
}

function validateClDocument(type: string, number: string): boolean {
  if (type.trim().toUpperCase() !== 'RUT') return false;
  return isValidRut(number);
}

type BillingSnapshotLike = {
  document_type?: unknown;
  document_number?: unknown;
};

/**
 * Fuentes del RUT en la orden, en orden de prioridad:
 * 1. `metadata.billing_snapshot.{document_type: 'RUT', document_number}` (checkout con perfil de facturación)
 * 2. `metadata.rut` (patrón aec-chile-backend para persona)
 * 3. `metadata.billing_address.rut` (patrón aec para empresa con factura)
 */
function extractRawRut(metadata: Record<string, unknown> | null): string | null {
  const snapshot = (metadata?.billing_snapshot ?? null) as BillingSnapshotLike | null;
  if (
    typeof snapshot?.document_type === 'string' &&
    snapshot.document_type.trim().toUpperCase() === 'RUT' &&
    typeof snapshot.document_number === 'string'
  ) {
    return snapshot.document_number;
  }
  if (typeof metadata?.rut === 'string' && metadata.rut.trim()) {
    return metadata.rut;
  }
  const billingAddress = metadata?.billing_address as { rut?: unknown } | null | undefined;
  if (typeof billingAddress?.rut === 'string' && billingAddress.rut.trim()) {
    return billingAddress.rut;
  }
  return null;
}

export const chileLayer: CountryLayer = {
  code: 'CL',
  currency: 'CLP',
  documentTypes: ['RUT'],

  inferDocument(order): ErpFiscalDocument {
    const raw = extractRawRut(order.metadata ?? null);
    if (!raw) return { type: null, number: null };
    const formatted = formatRut(raw);
    if (!formatted) {
      // RUT inválido → consumidor final (Bsale acepta boleta sin cliente).
      return { type: null, number: null };
    }
    return { type: 'RUT', number: formatted };
  },

  validateDocument: validateClDocument,

  normalizePhone(phone): string | null {
    if (!phone) return null;
    const trimmed = String(phone).trim();
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return null;
    return hasPlus ? `+${digits}` : digits;
  },

  normalizePostalCode(postal): string | null {
    if (!postal) return null;
    const normalized = String(postal).trim().toUpperCase();
    return normalized || null;
  },
};
