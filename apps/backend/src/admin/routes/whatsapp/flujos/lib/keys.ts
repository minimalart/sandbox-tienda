/**
 * Qué hace cada tecla, y cuándo NO hace nada.
 *
 * La guarda es lo importante: React Flow trae su propio `deleteKeyCode`, y con el
 * inspector al lado del canvas eso significa que borrar una letra del texto de un
 * mensaje —con el nodo todavía seleccionado— borraba el paso entero. Por eso el
 * canvas va con `deleteKeyCode={null}` y el teclado lo maneja el editor, que sí
 * puede preguntar dónde está el foco.
 */

/** Lo mínimo que hace falta de un elemento del DOM para decidir. */
type FocusLike = {
  tagName?: string;
  isContentEditable?: boolean;
} | null | undefined;

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** `true` si el foco está en algo donde el operador ESTÁ ESCRIBIENDO. */
export function isEditableTarget(target: FocusLike): boolean {
  if (!target) return false;
  if (target.isContentEditable === true) return true;
  const tag = (target.tagName ?? '').toUpperCase();
  return EDITABLE_TAGS.has(tag);
}

/** Las dos teclas que borran. `Escape` NO borra: sólo limpia la selección. */
export function isDeleteKey(key: string): boolean {
  return key === 'Delete' || key === 'Backspace';
}

// ─── Atajos ───────────────────────────────────────────────────────────────────

export type ShortcutAction =
  | 'delete'
  | 'save'
  | 'undo'
  | 'redo'
  | 'copy'
  | 'paste'
  | 'duplicate'
  | 'select-all'
  | 'escape'
  | 'fit'
  | 'zoom-in'
  | 'zoom-out'
  | 'help';

/** Lo mínimo de un evento de teclado para poder decidir, y para poder testearlo. */
export type KeyEvent = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

/**
 * Qué atajo corresponde a esta tecla, o `null`.
 *
 * `editing` es la guarda que importa: con el foco en un campo del inspector, la
 * mayoría de los atajos tienen que dejar pasar la tecla al input. Ctrl+S y Escape son
 * la excepción —guardar mientras se escribe es exactamente lo que la mano hace sola, y
 * Escape tiene que poder cerrar—; Ctrl+Z NO lo es: adentro de un campo, deshacer es el
 * del navegador sobre el texto, y robárselo para deshacer una operación del canvas
 * sería quitarle al operador el undo que espera.
 */
export function shortcutFor(event: KeyEvent, ctx: { editing: boolean }): ShortcutAction | null {
  const mod = Boolean(event.ctrlKey || event.metaKey);
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

  if (mod && key === 's') return 'save';
  if (key === 'Escape') return 'escape';
  if (ctx.editing) return null;

  if (mod) {
    if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
    if (key === 'y') return 'redo';
    if (key === 'c') return 'copy';
    if (key === 'v') return 'paste';
    if (key === 'd') return 'duplicate';
    if (key === 'a') return 'select-all';
    return null;
  }

  if (isDeleteKey(key)) return 'delete';
  if (key === 'f') return 'fit';
  if (key === '+' || key === '=') return 'zoom-in';
  if (key === '-' || key === '_') return 'zoom-out';
  if (key === '?') return 'help';
  return null;
}

/** Los atajos que se le muestran al operador, en el orden en que se explican. */
export const SHORTCUT_HELP: ReadonlyArray<{ keys: string; what: string }> = [
  { keys: 'Ctrl+S', what: 'Guardar el borrador' },
  { keys: 'Ctrl+Z', what: 'Deshacer' },
  { keys: 'Ctrl+Shift+Z', what: 'Rehacer' },
  { keys: 'Ctrl+C / Ctrl+V', what: 'Copiar y pegar los pasos elegidos' },
  { keys: 'Ctrl+D', what: 'Duplicar' },
  { keys: 'Ctrl+A', what: 'Elegir todos los pasos' },
  { keys: 'Supr', what: 'Borrar lo elegido' },
  { keys: 'F', what: 'Ajustar el recorrido a la pantalla' },
  { keys: '+ / −', what: 'Acercar y alejar' },
  { keys: 'Esc', what: 'Soltar la selección' },
];
