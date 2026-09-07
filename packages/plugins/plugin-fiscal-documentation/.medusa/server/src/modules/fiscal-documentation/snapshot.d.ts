import type { NormalizedTaxpayer } from '../../lib/arca/types';
import type { FiscalDiffEntry, FiscalSnapshot } from './types';
/**
 * Construye el snapshot persistible a partir de la respuesta normalizada de ARCA.
 * Guarda todo lo que sale del lookup para poder reconstruir el estado exacto.
 */
export declare function buildSnapshot(taxpayer: NormalizedTaxpayer): FiscalSnapshot;
/**
 * Hash sha256 del contenido fiscal del snapshot. Excluye `verified_at` a
 * propósito: dos consultas idénticas hechas en momentos distintos deben producir
 * el mismo hash (así el diff detecta cambios de DATOS, no de timestamp).
 */
export declare function hashSnapshot(snapshot: FiscalSnapshot): string;
/**
 * Compara dos snapshots y devuelve solo los campos que cambiaron
 * (`before` = versión anterior, `after` = versión nueva).
 */
export declare function diffSnapshots(before: FiscalSnapshot, after: FiscalSnapshot): FiscalDiffEntry[];
