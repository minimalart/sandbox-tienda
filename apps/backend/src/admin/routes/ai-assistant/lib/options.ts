// Opciones propuestas por el agente (estilo AskUserQuestion de Claude): cuando
// el asistente le hace una pregunta al usuario, emite un bloque
// <ask_options>{"options":[...]}</ask_options> al final del mensaje. El chat lo
// parsea para renderizar chips clickeables y lo saca del texto visible. Mismo
// patrón que el payload <sales_ui> de `visuals.ts`.

export const ASK_OPTIONS_START = '<ask_options>';
export const ASK_OPTIONS_END = '</ask_options>';

/** Extrae hasta 6 opciones (strings, deduplicadas) del bloque; null si no hay. */
export function parseAskOptions(content: string): string[] | null {
  const start = content.indexOf(ASK_OPTIONS_START);
  const end = content.indexOf(ASK_OPTIONS_END);
  if (start === -1 || end === -1 || end <= start) return null;

  const raw = content.slice(start + ASK_OPTIONS_START.length, end).trim();
  try {
    const parsed = JSON.parse(raw) as { options?: unknown };
    if (!Array.isArray(parsed.options)) return null;
    const seen = new Set<string>();
    const options: string[] = [];
    for (const o of parsed.options) {
      if (typeof o !== 'string') continue;
      const s = o.trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      options.push(s);
      if (options.length >= 6) break;
    }
    return options.length > 0 ? options : null;
  } catch {
    return null;
  }
}

/** Devuelve el contenido sin el bloque <ask_options> (para el texto visible). */
export function stripAskOptions(content: string): string {
  const start = content.indexOf(ASK_OPTIONS_START);
  const end = content.indexOf(ASK_OPTIONS_END);
  if (start === -1) return content;
  if (end === -1 || end <= start) return content.slice(0, start).trim();
  return `${content.slice(0, start)}${content.slice(end + ASK_OPTIONS_END.length)}`.trim();
}
