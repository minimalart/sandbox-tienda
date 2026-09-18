import { load as loadHtml, type Cheerio } from 'cheerio';
// Derive DOM types through our direct dependency, not its transitive packages.
type AnyNode = ReturnType<Cheerio<never>['contents']>[number];
type Element = Extract<AnyNode, { name: string; attribs: Record<string, string> }>;

/**
 * HTML → Markdown liviano para descripciones editoriales que llegan de ERPs con
 * eCommerce integrado (Odoo `website_sale`: `description_ecommerce`,
 * `website_description`). Cubre SOLO los tags que Odoo emite desde su website
 * builder: encabezados, párrafos, listas, énfasis, links y saltos.
 *
 * Diseño:
 *   - Zero dependencias nuevas: cheerio ya está instalado.
 *   - Tags fuera de la allowlist se aplanan (se conserva el texto, se descarta
 *     el envoltorio) — no rompemos por ver `<figure>` o un snippet del builder.
 *   - Atributos `data-oe-*`, `class`, `style` se ignoran: son ruido del editor
 *     de Odoo, no información del catálogo.
 *   - Espacios en blanco se colapsan al estilo Markdown: bloques separados por
 *     `\n\n`, saltos internos por `\n`. Nunca devuelve trailing whitespace.
 *   - Vacío → `null`. Un input que quede vacío después de normalizar (todo
 *     comment/whitespace/tags vacíos) también devuelve `null`.
 *
 * Fuera de scope: tablas (`<table>`), imágenes (`<img>`), código en bloque
 * (`<pre>`/`<code>`) — Odoo no los usa en las descripciones muestreadas y
 * agregarlos abre casos borde de escape en Markdown que no queremos manejar
 * hasta que sean necesarios. Los tags fuera de la allowlist se aplanan a su
 * texto sin decorar.
 */
export function htmlToMarkdown(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // Si no hay tags, es texto plano: devolvemos limpio, sin pasar por cheerio.
  if (!/<[a-z!/]/i.test(trimmed)) {
    const flattened = collapseInlineWhitespace(trimmed);
    return flattened.length > 0 ? flattened : null;
  }

  const $ = loadHtml(trimmed, null, false);
  const root = $.root()[0] as AnyNode | undefined;
  if (!root) return null;

  // `wrapBlock` agrega `\n\n` antes y después de cada bloque; cuando dos bloques
  // son adyacentes se acumulan a `\n\n\n\n`. Colapsamos a exactamente dos.
  const out = renderNode(root).replace(/\n{3,}/g, '\n\n').trim();
  return out.length > 0 ? out : null;
}

/** Bloque = separador `\n\n`. Inline = concatenación directa. */
function renderNode(node: AnyNode): string {
  if (node.type === 'text') {
    return (node as { data: string }).data;
  }
  if (node.type === 'comment') {
    return '';
  }
  if (node.type === 'tag' || node.type === 'root' || node.type === 'style' || node.type === 'script') {
    if (node.type === 'style' || node.type === 'script') return '';
    const el = node as Element & { children: AnyNode[] };
    const tag = (el.name || '').toLowerCase();
    const children = () => (el.children || []).map(renderNode).join('');

    switch (tag) {
      case 'br':
        return '\n';
      case 'p':
      case 'div':
      case 'section':
      case 'article':
        return wrapBlock(children());
      case 'h1':
        return wrapBlock(`# ${collapseInlineWhitespace(children())}`);
      case 'h2':
        return wrapBlock(`## ${collapseInlineWhitespace(children())}`);
      case 'h3':
        return wrapBlock(`### ${collapseInlineWhitespace(children())}`);
      case 'h4':
        return wrapBlock(`#### ${collapseInlineWhitespace(children())}`);
      case 'h5':
        return wrapBlock(`##### ${collapseInlineWhitespace(children())}`);
      case 'h6':
        return wrapBlock(`###### ${collapseInlineWhitespace(children())}`);
      case 'strong':
      case 'b': {
        const inner = collapseInlineWhitespace(children());
        return inner.length > 0 ? `**${inner}**` : '';
      }
      case 'em':
      case 'i': {
        const inner = collapseInlineWhitespace(children());
        return inner.length > 0 ? `*${inner}*` : '';
      }
      case 'u': {
        // Markdown estándar no tiene subrayado; se preserva como texto plano.
        return collapseInlineWhitespace(children());
      }
      case 'a': {
        const href = (el.attribs?.href || '').trim();
        const label = collapseInlineWhitespace(children());
        if (label.length === 0) return '';
        return href.length > 0 ? `[${label}](${href})` : label;
      }
      case 'ul':
        return wrapBlock(renderList(el, false));
      case 'ol':
        return wrapBlock(renderList(el, true));
      case 'li':
        // Un `<li>` suelto (sin `<ul>`/`<ol>` padre) es basura del builder — lo
        // aplanamos como texto. La ruta normal pasa por `renderList`.
        return collapseInlineWhitespace(children());
      case 'hr':
        return wrapBlock('---');
      default:
        // Tag desconocido: se aplana su contenido, se descarta el envoltorio.
        return children();
    }
  }
  return '';
}

function renderList(el: Element & { children: AnyNode[] }, ordered: boolean): string {
  const items: string[] = [];
  let index = 1;
  for (const child of el.children || []) {
    if (child.type !== 'tag') continue;
    const childEl = child as Element & { children: AnyNode[] };
    if ((childEl.name || '').toLowerCase() !== 'li') continue;
    const rawContent = (childEl.children || []).map(renderNode).join('');
    const content = collapseInlineWhitespace(rawContent);
    if (content.length === 0) continue;
    const bullet = ordered ? `${index}.` : '-';
    // Un `<li>` con hijos multi-línea (por ejemplo un `<ul>` anidado) se sangra
    // con dos espacios en las líneas de continuación.
    const lines = content.split('\n');
    items.push(`${bullet} ${lines[0]}`);
    for (const line of lines.slice(1)) {
      items.push(line.length > 0 ? `  ${line}` : '');
    }
    index += 1;
  }
  return items.join('\n');
}

/** Separa un bloque del anterior con doble newline sin generar corridas de 3+. */
function wrapBlock(inner: string): string {
  const trimmed = inner.replace(/^\s+|\s+$/g, '');
  if (trimmed.length === 0) return '';
  return `\n\n${trimmed}\n\n`;
}

/**
 * Colapsa runs de whitespace a un solo espacio y trimea. Se aplica solo a
 * contexto inline — los bloques van por `wrapBlock` que preserva `\n\n`.
 */
function collapseInlineWhitespace(text: string): string {
  return text.replace(/[\t \r]+/g, ' ').replace(/ *\n */g, '\n').replace(/ {2,}/g, ' ').trim();
}
