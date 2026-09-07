import type { ReactNode } from 'react';

/**
 * Utilidades para el formato *propio* de WhatsApp (NO es markdown estándar):
 *   *negrita*   _cursiva_   ~tachado~   ```monoespaciado```
 * WhatsApp interpreta estos caracteres literales al mostrar el mensaje, así que
 * el body se manda tal cual — acá solo los renderizamos para la vista previa y
 * los insertamos desde el toolbar.
 */

export type WhatsAppMark = 'bold' | 'italic' | 'strike' | 'mono';

/** Marcadores de apertura/cierre por tipo de formato. */
export const WA_MARKERS: Record<WhatsAppMark, { before: string; after: string }> = {
  bold: { before: '*', after: '*' },
  italic: { before: '_', after: '_' },
  strike: { before: '~', after: '~' },
  mono: { before: '```', after: '```' },
};

/**
 * Envuelve la selección de un textarea con los marcadores indicados. Si no hay
 * selección, inserta los marcadores y deja el cursor en el medio. Devuelve el
 * nuevo valor y el rango a re-seleccionar para restaurar el foco.
 */
export function wrapSelection(
  el: HTMLTextAreaElement,
  value: string,
  mark: WhatsAppMark,
): { next: string; selStart: number; selEnd: number } {
  const { before, after } = WA_MARKERS[mark];
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const selected = value.slice(start, end);
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  const selStart = start + before.length;
  const selEnd = selStart + selected.length;
  return { next, selStart, selEnd };
}

// Un token de formato inline, o un placeholder {{n}}, o monoespaciado (que puede
// abarcar varias líneas y NO se re-parsea por dentro).
// IMPORTANTE: como renderWhatsAppPreview es recursiva, cada invocación crea su
// PROPIA instancia del regex. Un regex con flag `g` a nivel de módulo guarda
// estado en `lastIndex`; compartirlo entre la llamada externa y la interna lo
// corrompe y provoca un loop infinito.
const tokenRegex = () =>
  /```([\s\S]+?)```|\*([^*\n]+?)\*|_([^_\n]+?)_|~([^~\n]+?)~|(\{\{\s*\d+\s*\}\})/g;

export type PreviewOptions = {
  /** Valores de ejemplo por variable: examples[0] → {{1}}, examples[1] → {{2}}, … */
  examples?: string[];
  keyPrefix?: string;
};

/**
 * Convierte texto con formato WhatsApp en nodos React para la vista previa.
 * Soporta anidado (ej. `*_negrita cursiva_*`) re-parseando el contenido de cada
 * marca — salvo el monoespaciado, que se muestra literal.
 *
 * Si se pasan `examples`, cada `{{n}}` con ejemplo cargado se reemplaza por su
 * valor (resaltado suave, para que se note que es dinámico); si no hay ejemplo,
 * se sigue mostrando `{{n}}`.
 */
export function renderWhatsAppPreview(
  text: string,
  options: PreviewOptions = {},
): ReactNode[] {
  const { examples, keyPrefix = 'wa' } = options;
  const nodes: ReactNode[] = [];
  const token = tokenRegex();
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = token.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const key = `${keyPrefix}-${i++}`;
    const [, mono, bold, italic, strike, placeholder] = match;

    if (mono !== undefined) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-black/10 px-1 font-mono text-[0.85em]"
        >
          {mono}
        </code>,
      );
    } else if (bold !== undefined) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {renderWhatsAppPreview(bold, { examples, keyPrefix: key })}
        </strong>,
      );
    } else if (italic !== undefined) {
      nodes.push(
        <em key={key}>{renderWhatsAppPreview(italic, { examples, keyPrefix: key })}</em>,
      );
    } else if (strike !== undefined) {
      nodes.push(
        <span key={key} className="line-through">
          {renderWhatsAppPreview(strike, { examples, keyPrefix: key })}
        </span>,
      );
    } else if (placeholder !== undefined) {
      const n = Number(placeholder.replace(/\D/g, ''));
      const example = examples?.[n - 1]?.trim();
      if (example) {
        // Con ejemplo cargado: se ve como el mensaje real (texto plano, apenas
        // resaltado). `overflow-wrap:anywhere` corta URLs largas sin desbordar.
        nodes.push(
          <span key={key} className="font-medium [overflow-wrap:anywhere]">
            {example}
          </span>,
        );
      } else {
        // Sin ejemplo: se resalta el hueco {{n}} para que se note que falta.
        nodes.push(
          <span
            key={key}
            className="rounded bg-emerald-600/15 px-1 font-medium text-emerald-800"
          >
            {placeholder}
          </span>,
        );
      }
    }
    lastIndex = token.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}
