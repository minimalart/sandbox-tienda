/**
 * Tipos compartidos del entonado. Viven acá y no en el modal porque los usan los
 * DOS flujos: base → color (el configurador del PDP) y color → base (la página
 * de colores), y esta última no tiene ningún modal.
 */

/** Un color de la carta, tal como lo devuelve /store/tinting/{colors,catalog}. */
export type TintColor = {
  code: string
  name: string
  collection: string
  family: string | null
  hex: string | null
}
