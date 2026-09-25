import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EMAIL_TEMPLATE_DESIGNS } from './email-template-designs';
import {
  renderPuckEmailHtml,
  type PuckEmailDocument,
} from '../modules/email-template/render-email';

/**
 * El documento Puck (`design`) es la fuente de verdad del mail y `html` es un
 * cache derivado: el POST de /admin/email-templates/:id re-renderiza el design y
 * pisa el html. Así que cualquier bloque que se caiga del design desaparece del
 * mail enviado, sin error y sin log.
 *
 * El modo de falla que este archivo protege es el más caro de todos: el mail YA
 * SALIÓ. En desdeelsur la plantilla `password-reset` quedó con un design SIN
 * bloque `Button` — texto "Hacé clic en el botón" y ningún botón — y el usuario
 * que pedía restablecer su contraseña no tenía forma de hacerlo. La única pista
 * era un `RawHtml` con id literal `legacy-html` y contenido `<p></p>`: el rastro
 * de `htmlFallbackDesign` (src/admin/routes/email-templates/[id]/page.tsx), la
 * conversión del HTML legacy a bloques Puck.
 *
 * La propiedad que se verifica NO es "existe un bloque Button" (mañana el CTA
 * puede ser un RawHtml y seguiría estando bien) sino la real: **el HTML que sale
 * del design conserva los links de acción del HTML semilla**. El HTML semilla de
 * seed-email-templates.ts es el contrato: si ahí hay un `href="{{link_reseteo}}"`,
 * el mail renderizado tiene que tenerlo.
 *
 * El HTML semilla se lee del FUENTE en vez de importarse porque `SEED` no se
 * exporta y el módulo arrastra `@medusajs/framework` (necesita un container).
 */

const SEED_SRC = readFileSync(
  join(import.meta.dirname, 'seed-email-templates.ts'),
  'utf8',
);

// ─── Lectura del fuente de la semilla ────────────────────────────────────────

/** `const FOO_HTML = \`…\`` → { FOO_HTML: '…' }. */
function readHtmlConstants(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /^const ([A-Z0-9_]+_HTML) = `/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length;
    let i = start;
    // Backtick de cierre, salteando escapes (`\``, `\${`).
    while (i < src.length) {
      if (src[i] === '\\') {
        i += 2;
        continue;
      }
      if (src[i] === '`') break;
      i += 1;
    }
    out[m[1]!] = src.slice(start, i);
  }
  return out;
}

/** key de la plantilla → nombre de la constante con su HTML legacy. */
function readSeedKeyToHtmlConst(src: string): Record<string, string> {
  const body = src.slice(src.indexOf('const SEED: SeedEntry[] = ['));
  const at = [...body.matchAll(/key:\s*'([^']+)'/g)].map((m) => ({
    key: m[1]!,
    index: m.index!,
  }));
  const out: Record<string, string> = {};
  at.forEach((entry, i) => {
    const chunk = body.slice(entry.index, at[i + 1]?.index ?? body.length);
    const html = chunk.match(/\n\s*html:\s*([A-Z0-9_]+_HTML)/);
    if (html) out[entry.key] = html[1]!;
  });
  return out;
}

const HTML_CONSTANTS = readHtmlConstants(SEED_SRC);
const KEY_TO_HTML_CONST = readSeedKeyToHtmlConst(SEED_SRC);

// ─── Extracción de links de acción ───────────────────────────────────────────

/**
 * Texto visible de un fragmento de HTML, colapsado.
 *
 * Los comentarios y los espacios invisibles se van porque el `Button` de React
 * Email envuelve la etiqueta en spans con condicionales `<!--[if mso]>` y hair
 * spaces (`&#8202;`, `&#8203;`) para el padding en Outlook. Si no se limpian, la
 * etiqueta del botón renderizado nunca coincide con la del HTML semilla.
 */
function visibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|#160|#xa0|#8194|#8195|#8201|#8202|#8203|#x200a|#x200b|#65279);/gi, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Links de acción de un HTML de mail, como pares `href → etiqueta`.
 *
 * El par importa, no sólo el href: `password-reset` tiene DOS anclas al mismo
 * `{{link_reseteo}}` — el botón ("Restablecer contraseña") y el párrafo de
 * respaldo ("O copiá este enlace…", cuya etiqueta ES la URL). Comparar sólo
 * hrefs daba verde con el design roto de producción, porque el link seguía ahí
 * en el párrafo de respaldo: perdías el botón y el chequeo no se enteraba.
 *
 * Se descartan los que no son un CTA: `mailto:`/`tel:` (viven dentro de texto y
 * la conversión no los toca) y los `#` de relleno. El `<link>` de Google Fonts
 * del `<head>` no es un `<a>`, así que nunca entra.
 */
type ActionLink = { href: string; label: string };

function actionLinks(html: string): ActionLink[] {
  const out = new Map<string, ActionLink>();
  const re = /<a\b[^>]*?\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1]!.trim();
    if (!href || href === '#') continue;
    if (/^(mailto:|tel:|sms:)/i.test(href)) continue;
    const link = { href, label: visibleText(m[2]!) };
    out.set(describe(link), link);
  }
  return [...out.values()];
}

/** Forma canónica de un link, para comparar y para los mensajes de error. */
function describe(link: ActionLink): string {
  return `${link.href} → "${link.label}"`;
}

/** Sólo los destinos, para las aserciones que no miran la etiqueta. */
function actionHrefs(html: string): string[] {
  return [...new Set(actionLinks(html).map((l) => l.href))];
}

/** Las plantillas con design: son las únicas donde la conversión pudo perder algo. */
const KEYS_WITH_DESIGN = Object.keys(EMAIL_TEMPLATE_DESIGNS);

test('hay designs para revisar (si esto falla, el resto del archivo no prueba nada)', () => {
  assert.ok(
    KEYS_WITH_DESIGN.length >= 10,
    `se esperaban al menos 10 designs, hay ${KEYS_WITH_DESIGN.length}`,
  );
  assert.ok(
    Object.keys(HTML_CONSTANTS).length >= 10,
    'no se pudo leer el HTML semilla del fuente: cambió la forma de las constantes',
  );
  assert.ok(
    KEY_TO_HTML_CONST['password-reset'],
    'no se pudo mapear key → HTML semilla: cambió la forma del array SEED',
  );
});

test('el design conserva TODOS los links de acción de su HTML semilla', async () => {
  const losses: string[] = [];

  for (const key of KEYS_WITH_DESIGN) {
    const constName = KEY_TO_HTML_CONST[key];
    if (!constName) continue; // design sin fila en SEED: no hay contrato que cruzar
    const seedHtml = HTML_CONSTANTS[constName];
    assert.ok(seedHtml, `no se pudo leer ${constName}`);

    const expected = actionLinks(seedHtml);
    if (expected.length === 0) continue;

    const rendered = await renderPuckEmailHtml(EMAIL_TEMPLATE_DESIGNS[key]);
    const got = actionLinks(rendered).map(describe);

    for (const link of expected) {
      if (!got.includes(describe(link))) {
        losses.push(`${key}: falta el link ${describe(link)} (el HTML semilla lo tiene)`);
      }
    }
  }

  assert.deepEqual(
    losses,
    [],
    `la conversión a bloques perdió links de acción:\n  - ${losses.join('\n  - ')}`,
  );
});

test('password-reset manda el BOTÓN de reseteo, no sólo el link pelado', async () => {
  // Caso puntual y explícito además del barrido: es la plantilla donde perder el
  // CTA deja al usuario sin salida, y el texto del cuerpo ("Hacé clic en el
  // botón") queda mintiendo.
  const html = await renderPuckEmailHtml(EMAIL_TEMPLATE_DESIGNS['password-reset']);

  assert.ok(
    actionHrefs(html).includes('{{link_reseteo}}'),
    'el design de password-reset no renderiza ningún <a> a {{link_reseteo}}',
  );

  // El bug de producción dejaba el párrafo de respaldo ("O copiá este enlace…",
  // cuya etiqueta es la URL) y se comía el botón. Un ancla al mismo destino con
  // una ETIQUETA distinta de la URL es lo que distingue el botón del respaldo.
  const cta = actionLinks(html).filter(
    (l) => l.href === '{{link_reseteo}}' && l.label !== '{{link_reseteo}}',
  );
  assert.ok(
    cta.length > 0,
    `password-reset quedó sin botón: los únicos links a {{link_reseteo}} son ${JSON.stringify(actionLinks(html).map(describe))}`,
  );
});

test('el barrido DETECTA un design al que le sacaron el CTA', async () => {
  // El design que quedó en producción: los mismos bloques que
  // email-template-designs.ts pero SIN el Button, más el rastro de la conversión
  // (`legacy-html` con `<p></p>`). Si este design pasara el chequeo, el barrido
  // de arriba no protegería nada.
  const drifted: PuckEmailDocument = {
    root: { props: {} },
    content: [
      { type: 'Logo', props: { src: '{{logo_url}}', width: 200, align: 'center' } },
      { type: 'RawHtml', props: { id: 'legacy-html', html: '<p></p>' } },
      { type: 'Heading', props: { text: 'Restablecer contraseña', level: 'h1' } },
      { type: 'Text', props: { text: 'Recibimos una solicitud para restablecer tu contraseña.' } },
      { type: 'Text', props: { text: 'Hacé clic en el botón para crear una nueva contraseña.' } },
      { type: 'Text', props: { text: 'Si no solicitaste este cambio, podés ignorar este correo.' } },
      { type: 'Footer', props: { text: '© {{year}} {{cde_display_name}}.' } },
    ],
  };

  const html = await renderPuckEmailHtml(drifted);
  const seedHtml = HTML_CONSTANTS[KEY_TO_HTML_CONST['password-reset']!]!;

  const expected = actionLinks(seedHtml).map(describe);
  const got = actionLinks(html).map(describe);
  const missing = expected.filter((l) => !got.includes(l));

  assert.ok(
    missing.includes('{{link_reseteo}} → "Restablecer contraseña"'),
    `el barrido no detecta la pérdida del botón. esperados: ${JSON.stringify(expected)} / obtenidos: ${JSON.stringify(got)}`,
  );
});

test('un bloque sin renderer se degrada en su posición, no desaparece', async () => {
  // El seam donde el contenido se perdía en silencio: buildDocument() mapeaba un
  // `type` desconocido a `null`. Pasa cuando el config de Puck del admin gana un
  // bloque y nadie agrega el renderer del servidor, o cuando un design escrito
  // por un build nuevo lo renderiza un build viejo. Degradar, no borrar.
  const doc: PuckEmailDocument = {
    root: { props: {} },
    content: [
      { type: 'Heading', props: { text: 'Antes' } },
      { type: 'BloqueDelFuturo', props: { html: '<a href="{{link_reseteo}}">Restablecer</a>' } },
      { type: 'OtroBloqueDelFuturo', props: { text: 'texto que no se puede perder' } },
      { type: 'BloqueVacio', props: {} },
      { type: 'Heading', props: { text: 'Después' } },
    ],
  };

  const html = await renderPuckEmailHtml(doc);

  assert.ok(
    actionHrefs(html).includes('{{link_reseteo}}'),
    'el bloque desconocido con html se perdió: el CTA no llegó al mail',
  );
  assert.match(
    html,
    /texto que no se puede perder/,
    'el bloque desconocido con text se perdió',
  );
  assert.match(
    html,
    /<!-- email-template: bloque "BloqueVacio" sin renderer -->/,
    'el bloque sin nada renderizable tiene que dejar rastro auditable en el fuente',
  );
  // Y el orden se respeta: degradar en su posición, no apilar al final.
  assert.ok(
    html.indexOf('Antes') <
      html.indexOf('texto que no se puede perder') &&
      html.indexOf('texto que no se puede perder') < html.indexOf('Después'),
    'el bloque degradado salió fuera de su posición',
  );
});

/**
 * El color entonado en el mail.
 *
 * El bloque `LineItems` se genera POR CÓDIGO a partir de sus props, no se guarda
 * como markup en el design. Por eso el color se agrega acá y no en el JSON de
 * cada plantilla: es el único camino que alcanza a las instancias que tienen las
 * plantillas editadas a mano.
 *
 * OJO con el alcance real: `html` es un cache derivado. Un design ya guardado NO
 * incorpora este markup hasta que alguien vuelva a publicar la plantilla desde
 * el editor (`PATCH /admin/email-templates/:id` re-renderiza el design).
 */

test('el bloque de items renderiza el color entonado, condicionado', async () => {
  const doc: PuckEmailDocument = {
    content: [
      { type: 'LineItems', props: { id: 'items', source: 'order_items', currency: '$' } },
    ],
  };
  const html = await renderPuckEmailHtml(doc);

  // El `{{#if}}` tiene que llegar INTACTO a Handlebars: si el renderer lo
  // escapara, toda línea común dibujaría un "Color:" vacío.
  assert.match(html, /\{\{#if this\.color_label\}\}/);
  assert.match(html, /Color: \{\{this\.color_label\}\}/);
  assert.match(html, /\{\{\/if\}\}/);
});

test('el swatch cae a un gris neutro cuando la carta no tiene hex', async () => {
  // Inventar un color sería mostrarle al comprador una pintura que no es la que
  // va a recibir. El `{{else}}` es lo que lo evita.
  const doc: PuckEmailDocument = {
    content: [{ type: 'LineItems', props: { id: 'items' } }],
  };
  const html = await renderPuckEmailHtml(doc);
  assert.match(html, /\{\{#if this\.color_hex\}\}\{\{this\.color_hex\}\}\{\{else\}\}#d1d5db\{\{\/if\}\}/);
});

/**
 * DESDEELSUR-80/81: el mail admin mostraba la disponibilidad en una tabla
 * APARTE ("Disponibilidad en esta sucursal", duplicando el resumen del pedido)
 * y sólo para retiro. Ahora el badge va al lado de CADA ítem del resumen, para
 * CUALQUIER orden, y la tabla separada se eliminó del design.
 */

test('order-notification-admin: el badge de stock va en el LineItems (showStock), no en una tabla aparte', async () => {
  const design = EMAIL_TEMPLATE_DESIGNS['order-notification-admin']!;
  const lineItems = design.content?.find((b) => b.type === 'LineItems');
  assert.ok(lineItems, 'order-notification-admin perdió el bloque LineItems');
  assert.equal(lineItems!.props?.showStock, 'yes', 'el LineItems del mail admin tiene que pedir el badge de stock');

  const html = await renderPuckEmailHtml(design);
  assert.match(html, /\{\{#if this\.stock_status_label\}\}/, 'el badge por ítem no llegó al HTML renderizado');
});

test('order-notification-admin: la tabla "Disponibilidad en esta sucursal" ya no existe', async () => {
  const html = await renderPuckEmailHtml(EMAIL_TEMPLATE_DESIGNS['order-notification-admin']!);
  assert.doesNotMatch(html, /Disponibilidad en esta sucursal/);
});

test('order-notification-admin: sigue mostrando nombre/dirección/teléfono de la sucursal de retiro', async () => {
  const html = await renderPuckEmailHtml(EMAIL_TEMPLATE_DESIGNS['order-notification-admin']!);
  assert.match(html, /pickup_store\.name/);
  assert.match(html, /pickup_store\.address/);
  assert.match(html, /pickup_store\.phone/);
});

test('order-notification-admin: aviso de stock insuficiente + de qué sucursal es', async () => {
  const html = await renderPuckEmailHtml(EMAIL_TEMPLATE_DESIGNS['order-notification-admin']!);
  assert.match(html, /\{\{#if has_stock_issues\}\}/);
  assert.match(html, /\{\{#if stock_location_name\}\}/);
});
