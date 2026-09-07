import type { SettingDescriptor } from './descriptors/types';
import { coerceAndValidate, isUntouchedSecret } from './validate';

/**
 * Traduce un `POST /admin/app-settings` a una lista de escrituras y borrados.
 *
 * Es una función PURA a propósito: es donde viven las seis reglas de merge, que
 * son la parte del sistema donde un error se paga en credenciales borradas.
 * Poniéndolas acá se testean sin DB (`node:test`, la única forma que este repo
 * soporta) en vez de descubrirse en producción.
 */

export type WritePlanInput = {
  descriptors: SettingDescriptor[];
  /** Lo que mandó el admin. Es un PATCH: lo ausente no se toca. */
  values?: Record<string, unknown>;
  /** Borrado explícito por nombre. Nunca se infiere de un valor vacío. */
  unset?: string[];
};

export type PlannedWrite = { key: string; value: unknown; isSecret: boolean };

/**
 * El plan NO lleva `touchesBootTier`.
 *
 * Lo llevaba, y alimentaba el `restart_required` de la respuesta del POST. Se fue
 * con el tier `'boot'`: ese tier prometía "guardá y reiniciá" sobre una lectura que
 * `medusa-config.ts` nunca hizo (ver el docblock de `SettingTier`). Con cero
 * descriptores `boot`, el flag sólo podía valer `false` — o sea que era una rama
 * muerta que le decía a la UI que no hacía falta reiniciar, que casualmente era
 * cierto por el motivo equivocado.
 */
export type WritePlan =
  | { ok: true; writes: PlannedWrite[]; deletes: string[] }
  | { ok: false; errors: Record<string, string> };

export function buildWritePlan(input: WritePlanInput): WritePlan {
  const byKey = new Map(input.descriptors.map((d) => [d.key, d]));
  const values = input.values ?? {};
  const unset = input.unset ?? [];

  const errors: Record<string, string> = {};
  const writes: PlannedWrite[] = [];

  // Regla 4: una key desconocida es un error, no algo que se persiste callado.
  // Guardar typos acumula filas que nunca lee nadie, que es exactamente cómo se
  // pudre un config store.
  for (const key of Object.keys(values)) {
    if (!byKey.has(key)) errors[key] = 'No existe un ajuste con ese nombre en esta extensión.';
  }
  for (const key of unset) {
    if (!byKey.has(key)) errors[key] = 'No existe un ajuste con ese nombre en esta extensión.';
  }

  // Un mismo key en `values` y en `unset` es una contradicción del cliente: si
  // se eligiera uno en silencio, la mitad de las veces sería el que no era.
  for (const key of unset) {
    if (Object.hasOwn(values, key)) {
      errors[key] = 'No se puede guardar y borrar el mismo ajuste en la misma operación.';
    }
  }

  for (const [key, raw] of Object.entries(values)) {
    const descriptor = byKey.get(key);
    if (!descriptor || errors[key]) continue;

    // Regla 2: un input de secreto vacío significa "no toqué el campo
    // enmascarado". Se ignora, no se borra.
    if (isUntouchedSecret(descriptor, raw)) continue;

    const result = coerceAndValidate(descriptor, raw);
    if (!result.ok) {
      errors[key] = result.error;
      continue;
    }
    writes.push({ key, value: result.value, isSecret: descriptor.type === 'secret' });
  }

  // Regla 3: todo o nada. Una card guardada a medias es peor que una rechazada,
  // porque deja al operador sin saber qué quedó aplicado.
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return { ok: true, writes, deletes: [...unset] };
}
