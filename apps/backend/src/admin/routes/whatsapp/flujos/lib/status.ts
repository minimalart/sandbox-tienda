/**
 * Lo que dice el header: qué está publicado, qué hay sin guardar y cuántos
 * problemas tiene el recorrido.
 *
 * Está acá y no dentro del header porque son REGLAS, no pintura: "Publicado · v7"
 * y "Cambios sin guardar" son dos cosas distintas que pueden ser ciertas a la vez,
 * y confundirlas es lo que hoy hace que el editor no sepa decir si lo que el
 * cliente está viendo es lo que hay en pantalla.
 *
 * Un detalle del modelo que hay que respetar: publicar NO copia el borrador, lo
 * CONVIERTE en la versión activa. O sea que después de publicar no hay borrador
 * hasta el próximo guardado, y "sin borrador + hay activa" significa exactamente
 * "lo que ves es lo que está publicado".
 */

export type SaveState = 'idle' | 'saving' | 'error';

export type StatusInput = {
  /** Hay una fila `draft` guardada en la base. */
  hasDraft: boolean;
  /** Número de la versión activa, o `null` si el recorrido nunca se publicó. */
  activeVersion: number | null;
  /** Hay cambios en el canvas que todavía no se guardaron. */
  dirty: boolean;
  saveState: SaveState;
  issueCount: number;
};

export type PillColor = 'grey' | 'green' | 'orange' | 'red';

export type StatusPill = {
  /** Para la `key` de React y para los tests. */
  key: 'published' | 'draft' | 'issues';
  text: string;
  color: PillColor;
  /** Sólo el de problemas se puede tocar. */
  clickable?: boolean;
};

export function statusPills(input: StatusInput): StatusPill[] {
  const pills: StatusPill[] = [];

  pills.push(
    input.activeVersion !== null
      ? { key: 'published', text: `Publicado · v${input.activeVersion}`, color: 'green' }
      : { key: 'published', text: 'Sin publicar', color: 'grey' },
  );

  // El estado del borrador sólo aparece cuando HAY borrador o algo que guardar: en
  // un recorrido recién publicado y sin tocar, una segunda etiqueta gris no suma
  // nada y compite con el nombre de la pantalla.
  const draft = draftPill(input);
  if (draft) pills.push(draft);

  if (input.issueCount > 0) {
    pills.push({
      key: 'issues',
      text: `${input.issueCount} problema${input.issueCount === 1 ? '' : 's'}`,
      color: 'red',
      clickable: true,
    });
  }

  return pills;
}

function draftPill(input: StatusInput): StatusPill | null {
  // El error va primero: si el último guardado falló, lo que el operador tiene que
  // leer es eso y no "cambios sin guardar", que suena a que puede irse tranquilo.
  if (input.saveState === 'error') {
    return { key: 'draft', text: 'No se pudo guardar', color: 'red' };
  }
  if (input.saveState === 'saving') {
    return { key: 'draft', text: 'Guardando…', color: 'grey' };
  }
  if (input.dirty) {
    return { key: 'draft', text: 'Borrador · Cambios sin guardar', color: 'orange' };
  }
  if (input.hasDraft) {
    return { key: 'draft', text: 'Borrador · Guardado', color: 'grey' };
  }
  return null;
}

/**
 * El minimapa aparece solo cuando el recorrido ya no entra de un vistazo.
 *
 * Con un recorrido de tres pasos ocupa una esquina para no decir nada; con treinta
 * es la única forma de saber dónde estás parado. `pref` es la decisión explícita
 * del operador y gana siempre: si lo cerró, se queda cerrado aunque crezca.
 */
export const MINIMAP_AUTO_FROM = 9;

export function shouldShowMinimap(pref: boolean | null, nodeCount: number): boolean {
  if (pref !== null) return pref;
  return nodeCount >= MINIMAP_AUTO_FROM;
}
