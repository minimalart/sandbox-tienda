import type { ErpFiscalDocument } from '../types';
import type { CountryLayer } from './types';

/**
 * Capa país Argentina: ARS, CUIT/CUIL/DNI y el billing_snapshot que ya
 * escribe el checkout (`order.metadata.billing_snapshot.{document_type,
 * document_number}`, ver `src/subscribers/order-billing-snapshot.ts`).
 */

const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/** Checksum módulo 11 de AFIP para CUIT/CUIL (11 dígitos). */
export function isValidCuitCuil(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  const nums = digits.split('').map(Number);
  const sum = CUIT_WEIGHTS.reduce((acc, weight, i) => acc + weight * nums[i]!, 0);
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? 0 : mod;
  // Verificador 10 no existe (AFIP ajusta el prefijo en esos casos).
  if (expected === 10) return false;
  return expected === nums[10];
}

export function isValidDni(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 8;
}

type BillingSnapshotLike = {
  document_type?: unknown;
  document_number?: unknown;
};

function validateArDocument(type: string, number: string): boolean {
  const normalized = type.trim().toUpperCase();
  if (normalized === 'CUIT' || normalized === 'CUIL') return isValidCuitCuil(number);
  if (normalized === 'DNI') return isValidDni(number);
  return false;
}

export const argentinaLayer: CountryLayer = {
  code: 'AR',
  currency: 'ARS',
  documentTypes: ['CUIT', 'CUIL', 'DNI'],

  inferDocument(order): ErpFiscalDocument {
    const snapshot = (order.metadata?.billing_snapshot ?? null) as BillingSnapshotLike | null;
    const rawType = typeof snapshot?.document_type === 'string' ? snapshot.document_type : null;
    const rawNumber =
      typeof snapshot?.document_number === 'string' ? snapshot.document_number : null;
    if (!rawType || !rawNumber) {
      return { type: null, number: null };
    }
    const type = rawType.trim().toUpperCase();
    const number = rawNumber.replace(/\D/g, '');
    if (!validateArDocument(type, number)) {
      // Documento inválido → se trata como consumidor final; el detalle queda
      // en el payload sanitizado si hiciera falta auditar.
      return { type: null, number: null };
    }
    return { type, number };
  },

  validateDocument: validateArDocument,

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
