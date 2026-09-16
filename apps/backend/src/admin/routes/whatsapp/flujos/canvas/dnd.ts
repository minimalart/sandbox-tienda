import { NODE_TYPES, type NodeType } from '../_editor';

/**
 * El tipo MIME con el que viaja un paso desde la biblioteca hasta el canvas.
 *
 * Propio y no `text/plain`: si fuera texto suelto, soltar cualquier cosa arrastrada
 * de otra pestaña —una palabra, un link— crearía un paso con un tipo inventado.
 */
export const STEP_MIME = 'application/x-wa-step';

/** Lee el tipo de paso de un `DataTransfer`, o `null` si lo soltado no es uno nuestro. */
export function stepTypeFrom(data: DataTransfer | null): NodeType | null {
  const raw = data?.getData(STEP_MIME);
  if (!raw) return null;
  return (NODE_TYPES as readonly string[]).includes(raw) ? (raw as NodeType) : null;
}
