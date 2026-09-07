import { createHash } from 'node:crypto';
import type { NormalizedTaxpayer } from '../../lib/arca/types';
import type { FiscalDiffEntry, FiscalSnapshot } from './types';

/**
 * Construye el snapshot persistible a partir de la respuesta normalizada de ARCA.
 * Guarda todo lo que sale del lookup para poder reconstruir el estado exacto.
 */
export function buildSnapshot(taxpayer: NormalizedTaxpayer): FiscalSnapshot {
  return {
    tax_id: taxpayer.cuit,
    legal_name: taxpayer.legal_name,
    tax_condition: taxpayer.tax_condition,
    status: taxpayer.status,
    address: {
      address_line_1: taxpayer.address.address_line_1,
      city: taxpayer.address.city,
      province: taxpayer.address.province,
      postal_code: taxpayer.address.postal_code,
      country_code: taxpayer.address.country_code,
    },
    activities: [],
    source: 'arca',
    verified_at: taxpayer.verified_at,
  };
}

/**
 * Stringify determinístico (claves ordenadas) para que el hash sea estable
 * independientemente del orden de las propiedades.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',');
  return `{${body}}`;
}

/**
 * Hash sha256 del contenido fiscal del snapshot. Excluye `verified_at` a
 * propósito: dos consultas idénticas hechas en momentos distintos deben producir
 * el mismo hash (así el diff detecta cambios de DATOS, no de timestamp).
 */
export function hashSnapshot(snapshot: FiscalSnapshot): string {
  const { verified_at: _ignored, ...fiscal } = snapshot;
  return createHash('sha256').update(stableStringify(fiscal)).digest('hex');
}

/** Campos comparados y su etiqueta legible (orden de presentación). */
const DIFF_FIELDS: Array<{ field: string; label: string; get: (s: FiscalSnapshot) => string }> = [
  { field: 'legal_name', label: 'Razón social', get: (s) => s.legal_name },
  { field: 'tax_condition', label: 'Condición IVA', get: (s) => s.tax_condition },
  { field: 'status', label: 'Estado', get: (s) => s.status },
  { field: 'address_line_1', label: 'Domicilio', get: (s) => s.address.address_line_1 },
  { field: 'city', label: 'Localidad', get: (s) => s.address.city },
  { field: 'province', label: 'Provincia', get: (s) => s.address.province },
  { field: 'postal_code', label: 'Código postal', get: (s) => s.address.postal_code },
  { field: 'activities', label: 'Actividades', get: (s) => s.activities.join(', ') },
];

/**
 * Compara dos snapshots y devuelve solo los campos que cambiaron
 * (`before` = versión anterior, `after` = versión nueva).
 */
export function diffSnapshots(before: FiscalSnapshot, after: FiscalSnapshot): FiscalDiffEntry[] {
  const changes: FiscalDiffEntry[] = [];
  for (const { field, label, get } of DIFF_FIELDS) {
    const b = get(before) ?? '';
    const a = get(after) ?? '';
    if (b !== a) {
      changes.push({ field, label, before: b || null, after: a || null });
    }
  }
  return changes;
}
