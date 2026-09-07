/**
 * Merge de `erp_config.settings`.
 *
 * El merge plano de primer nivel que había antes borraba
 * `catalog_sync.category_map` y `catalog_sync.last_synced_at` en CADA guardado
 * del admin, porque la UI reconstruye el bloque `catalog_sync` entero y no
 * incluye esas dos claves (el mapa no tiene UI y el watermark lo escribe el
 * motor). Consecuencia real: perder el watermark hace que la corrida siguiente
 * pida el catálogo completo, y perder el mapa descategoriza las altas.
 *
 * Por eso las secciones conocidas se mergean UN NIVEL MÁS ABAJO. Dentro de una
 * sección:
 * - los arrays se reemplazan enteros (hay que poder borrar una fila de
 *   `price_lists`);
 * - un `null` explícito pisa (es "limpiar este valor");
 * - una clave ausente conserva lo guardado.
 *
 * `catalog_sync.images` necesita UN NIVEL MÁS por el mismo motivo, dos escalones
 * abajo. La UI reconstruye ese bloque con `enabled` y a veces `backfill_pending`,
 * y NUNCA manda `failures` (el registro de artículos cuya imagen no se puede
 * bajar, que escribe solo el motor) ni `min_dimension_px`. Con el merge de un
 * solo nivel, cada guardado de la config borraba el registro entero: la corrida
 * siguiente volvía a intentar los mismos códigos rotos y el backfill se trababa
 * de nuevo, que es exactamente lo que `sync/image-failures.ts` vino a arreglar.
 * El arrastre a mano de `backfill_pending` que hace la UI es la cicatriz de ese
 * mismo problema; con esto deja de hacer falta uno por clave.
 */

const NESTED_KEYS = [
  'stock_sync',
  'catalog_sync',
  'outbox',
  'sales_notify',
  'contabilium',
  'bsale',
  'zeus',
  'tinting',
] as const;

/**
 * Sub-secciones que además se mergean DENTRO de su sección. `sección.subclave`.
 * Ver el porqué en el comentario de arriba.
 */
const NESTED_SUBKEYS: Record<string, readonly string[]> = {
  catalog_sync: ['images'],
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function mergeErpSettings(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const base = existing ?? {};
  const out: Record<string, unknown> = { ...base, ...patch };

  for (const key of NESTED_KEYS) {
    const previous = base[key];
    const next = patch[key];
    // Solo se mergea cuando ambos lados son objetos: un `null` explícito o un
    // valor primitivo pisan la sección completa a propósito.
    if (isPlainObject(previous) && isPlainObject(next)) {
      const merged: Record<string, unknown> = { ...previous, ...next };
      for (const subKey of NESTED_SUBKEYS[key] ?? []) {
        const previousSub = previous[subKey];
        const nextSub = next[subKey];
        // Mismo criterio que un nivel más arriba: un `null` explícito o un
        // primitivo pisan la sub-sección completa a propósito.
        if (isPlainObject(previousSub) && isPlainObject(nextSub)) {
          merged[subKey] = { ...previousSub, ...nextSub };
        }
      }
      out[key] = merged;
    }
  }

  return out;
}
