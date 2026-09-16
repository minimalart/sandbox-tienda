import type { SettingType } from '../../../modules/app-settings/descriptors/types';

/**
 * Traduce el borrador de una card (`draft` + `unset`) al PATCH que espera
 * `POST /admin/app-settings`.
 *
 * Existe por un bug concreto: un operador abría Sendgrid → Configuración, tocaba
 * "Base de los iconos del email", lo dejaba en blanco y después editaba el mail de
 * avisos. El borrador quedaba con `EMAIL_ICONS_BASE_URL: ''`, el backend lo
 * rechazaba con "No puede estar vacío" y el guardado entero (todo o nada) caía
 * con un toast genérico — por un campo opcional que el operador ni quería tocar.
 *
 * El backend tiene razón en no aceptar `''` como valor: borrar es explícito, por
 * `unset[]`. Lo que faltaba era que la UI hablara ese idioma. Acá se decide, por
 * campo, qué significa un input en blanco:
 *
 *  - sin override guardado → no hay nada que guardar; el campo no viaja.
 *  - con override guardado → el operador lo VACIÓ: es un "Restaurar", va a `unset`.
 *  - secreto → "no toqué el campo enmascarado"; borrar un secreto es por botón.
 *
 * Y un valor tipeado DESPUÉS de un "Restaurar" gana sobre el borrado encolado: sin
 * esto la key viajaba en `values` y en `unset` a la vez y el backend la rechazaba
 * como contradicción.
 *
 * Es PURA para que la cubra `node:test`, la única forma de test que este repo
 * soporta en el admin (`src/admin` está fuera del `tsc` del backend).
 */

export type SavePayload = {
  values: Record<string, unknown>;
  unset: string[];
};

export type SavePayloadInput = {
  /** Tipo del descriptor de cada key. `undefined` = key desconocida (se manda igual, el backend la rechaza con su mensaje). */
  typeOf: (key: string) => SettingType | undefined;
  /** Hay override guardado en la capa que la card edita (`AppSettingState.is_set`). */
  isSet: (key: string) => boolean;
  draft: Record<string, unknown>;
  unset: readonly string[];
};

/**
 * Un input en blanco. Los booleanos nunca lo están: el switch siempre tiene
 * estado. Un `null`/`undefined` cuenta como blanco por si algún control lo emite
 * al limpiarse.
 */
export function isBlankDraft(type: SettingType | undefined, value: unknown): boolean {
  if (type === 'boolean') return false;
  if (value === null || value === undefined) return true;
  return typeof value === 'string' && value.trim() === '';
}

export function buildSavePayload(input: SavePayloadInput): SavePayload {
  const values: Record<string, unknown> = {};
  const unset = new Set(input.unset);

  for (const [key, raw] of Object.entries(input.draft)) {
    const type = input.typeOf(key);

    if (isBlankDraft(type, raw)) {
      // Un secreto en blanco es "no lo toqué", nunca "borralo": borrar un secreto
      // tiene su propio botón y viaja por `unset` desde ahí.
      if (type === 'secret') continue;
      // Vaciar un override guardado es la misma intención que "Restaurar".
      if (input.isSet(key)) unset.add(key);
      // Sin override, un blanco no tiene nada que guardar ni que borrar.
      continue;
    }

    values[key] = raw;
    // Tipear después de "Restaurar": gana lo tipeado.
    unset.delete(key);
  }

  return { values, unset: [...unset] };
}
