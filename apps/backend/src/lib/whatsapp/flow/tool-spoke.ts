/**
 * ¿LA ACCIÓN ATENDIÓ EL TURNO?
 *
 * Es una línea y es la que dejaba MUDO al bot, así que vive acá con sus tests.
 *
 * Las tools nacieron para el agente: devuelven texto dirigido AL MODELO —"No
 * encontré productos, pedile al cliente que lo nombre de otra forma"— y confían en
 * que alguien lo lea y hable. En un recorrido dibujado no hay modelo. Tomar esa
 * devolución como "turno atendido" es lo que hacía que el cliente escribiera el
 * nombre de un producto y no volviera NADA: la búsqueda no encontraba nada, la tool
 * devolvía su instrucción, el recorrido se daba por satisfecho y la conversación
 * quedaba muerta ahí.
 *
 * El acuse bueno es `sentUserMessage`, porque las tools lo prenden DENTRO del
 * `if (sent)` — o sea exactamente cuando el mensaje salió, no cuando lo intentaron.
 */

export type ToolTurn = {
  /** Lo que devolvió la tool. `undefined` = ni siquiera corrió. */
  returned: string | undefined;
  /** El paso está marcado como silencioso: habla el recorrido, no la tool. */
  silent: boolean;
  /** La tool prendió `sentUserMessage`: le mandó algo al cliente. */
  spoke: boolean;
};

/**
 * `false` = el recorrido NO resolvió el turno y hay que cederlo.
 *
 * Ceder no es fallar: el webhook tiene una red anti-silencio —el router, el modelo,
 * o el menú si el recorrido es exclusivo— y cualquiera de las tres es mejor que no
 * contestar. Lo único inaceptable es que el recorrido diga "atendido" sin que el
 * cliente haya recibido algo.
 */
export function toolHandledTurn({ returned, silent, spoke }: ToolTurn): boolean {
  // Ni corrió: no hay nada que discutir.
  if (returned === undefined) return false;
  /**
   * Una acción SILENCIOSA no habla por definición y eso está bien: es la que permite
   * "agregá al carrito y preguntá si quiere algo más" en un solo mensaje. Lo que
   * sigue lo dibuja el recorrido, así que el turno se atiende igual.
   */
  if (silent) return true;
  return spoke;
}
