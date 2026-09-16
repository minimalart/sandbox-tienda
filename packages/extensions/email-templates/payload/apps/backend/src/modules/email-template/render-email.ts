import { createElement, type ReactElement, type ReactNode } from 'react';
import {
  Body,
  Button,
  Column,
  Container,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Row,
  Section,
  Text,
} from '@react-email/components';
import { render } from '@react-email/render';

/**
 * Server-side renderer that turns a Puck JSON document into an email-safe HTML
 * string via React Email. This is the email counterpart of the storefront's
 * landing-renderer: a controlled, manual mapping from block `type` to a React
 * Email component, walked over the document's `content` array.
 *
 * IMPORTANT — why no JSX here:
 * the backend server build (`tsc`, then `medusa build`) compiles `src/**\/*.ts`
 * only and has no `jsx` compiler option (admin .tsx is built separately by
 * Vite). So this module is plain `.ts` and constructs the React tree with
 * `createElement` instead of JSX. Do NOT rename this to `.tsx`.
 *
 * IMPORTANT — Handlebars passthrough:
 * text children are rendered literally, so `{{var}}` tokens survive into the
 * output HTML untouched (react-dom escapes `&`/`<`/`>` but never `{`/`}`).
 * Loops/conditionals (`{{#each items}}`, `{{#if}}`) must live inside a `RawHtml`
 * block, whose markup is emitted verbatim via `dangerouslySetInnerHTML`. The
 * email provider then runs Handlebars over the whole string at send time.
 */

/** A single block instance as serialized by Puck. */
export interface PuckEmailBlock {
  type: string;
  props?: Record<string, any>;
}

/** Root-level document props (page background, container width, etc.). */
export interface PuckEmailRoot {
  props?: Record<string, any>;
}

/** The full Puck document persisted in `email_template.design`. */
export interface PuckEmailDocument {
  root?: PuckEmailRoot;
  content?: PuckEmailBlock[];
}

type BlockProps = Record<string, any>;
type BlockRenderer = (props: BlockProps, key: number) => ReactNode;

const FONT_FAMILY =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function toAlign(value: unknown): 'left' | 'center' | 'right' {
  return value === 'center' || value === 'right' ? value : 'left';
}

/**
 * If `src` is a single Handlebars token like "{{logo_url}}", returns the
 * variable name ("logo_url"); otherwise null. Used to guard token-based images
 * with `{{#if var}}…{{/if}}` so an unset variable renders nothing instead of a
 * broken <img>. Children passed as strings keep `{{ }}` literal (react-dom does
 * not escape braces), so the guard survives into the Handlebars pass.
 */
function handlebarsVar(src: unknown): string | null {
  if (typeof src !== 'string') return null;
  const m = src.match(/^\s*\{\{\s*([\w.]+)\s*\}\}\s*$/);
  return m?.[1] ?? null;
}

/**
 * Wraps `node` in a Handlebars {{#if var}} guard when `src` is a token. Returns
 * an array of children meant to be SPREAD into createElement (variadic children
 * need no keys — returning the array as a single child would trip React's
 * "unique key" warning).
 */
function guardByToken(src: unknown, node: ReactNode): ReactNode[] {
  const variable = handlebarsVar(src);
  return variable ? [`{{#if ${variable}}}`, node, '{{/if}}'] : [node];
}

/**
 * Block registry — the single source of truth for how each Puck block type is
 * turned into email markup. The admin Puck config (src/admin/lib/puck/
 * email-config.tsx) must keep the same component NAMES and PROP SHAPES.
 */
const BLOCKS: Record<string, BlockRenderer> = {
  Heading: ({ text, level, align, color }, key) =>
    createElement(
      Heading,
      {
        key,
        as: level === 'h1' || level === 'h3' ? level : 'h2',
        style: {
          margin: '0 0 16px',
          fontFamily: FONT_FAMILY,
          textAlign: toAlign(align),
          color: color || '#111827',
        },
      },
      text ?? '',
    ),

  Text: ({ text, align, color }, key) =>
    createElement(
      Text,
      {
        key,
        style: {
          margin: '0 0 16px',
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          lineHeight: '24px',
          color: color || '#374151',
          textAlign: toAlign(align),
          whiteSpace: 'pre-line',
        },
      },
      text ?? '',
    ),

  Button: ({ label, href, backgroundColor, textColor, align }, key) =>
    createElement(
      Section,
      { key, style: { textAlign: toAlign(align), margin: '0 0 16px' } },
      createElement(
        Button,
        {
          href: href || '#',
          style: {
            backgroundColor: backgroundColor || '#111827',
            color: textColor || '#ffffff',
            fontFamily: FONT_FAMILY,
            fontSize: '14px',
            fontWeight: 600,
            padding: '12px 24px',
            borderRadius: '8px',
            textDecoration: 'none',
            display: 'inline-block',
          },
        },
        label ?? '',
      ),
    ),

  Logo: ({ src, href, width, align }, key) => {
    if (!src) return null;
    const img = createElement(Img, {
      src,
      alt: 'logo',
      width: width ? Number(width) : 180,
      style: { display: 'inline-block', border: '0' },
    });
    const content = href ? createElement(Link, { href }, img) : img;
    return createElement(
      Section,
      { key, style: { textAlign: toAlign(align ?? 'center'), margin: '0 0 24px' } },
      ...guardByToken(src, content),
    );
  },

  Image: ({ src, alt, width, align }, key) =>
    src
      ? createElement(
          Section,
          { key, style: { textAlign: toAlign(align), margin: '0 0 16px' } },
          ...guardByToken(
            src,
            createElement(Img, {
              src,
              alt: alt ?? '',
              width: width ? Number(width) : undefined,
              style: {
                maxWidth: '100%',
                display: 'inline-block',
                border: '0',
              },
            }),
          ),
        )
      : null,

  Divider: (_props, key) =>
    createElement(Hr, {
      key,
      style: { borderColor: '#e5e7eb', margin: '16px 0' },
    }),

  Spacer: ({ size }, key) =>
    createElement(Section, {
      key,
      style: { height: `${Number(size) || 24}px`, lineHeight: `${Number(size) || 24}px` },
    }),

  Columns: ({ left, right }, key) => {
    const cellStyle = {
      width: '50%',
      verticalAlign: 'top' as const,
      padding: '0 8px',
    };
    const cellText = {
      margin: '0',
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      lineHeight: '24px',
      color: '#374151',
      whiteSpace: 'pre-line' as const,
    };
    return createElement(
      Section,
      { key, style: { margin: '0 0 16px' } },
      createElement(
        Row,
        null,
        createElement(
          Column,
          { style: cellStyle },
          createElement(Text, { style: cellText }, left ?? ''),
        ),
        createElement(
          Column,
          { style: cellStyle },
          createElement(Text, { style: cellText }, right ?? ''),
        ),
      ),
    );
  },

  Footer: ({ text, backgroundColor, textColor }, key) =>
    createElement(
      Section,
      {
        key,
        style: {
          backgroundColor: backgroundColor || 'transparent',
          padding: '24px 16px',
          marginTop: '16px',
          textAlign: 'center' as const,
        },
      },
      createElement(
        Text,
        {
          style: {
            margin: '0',
            fontFamily: FONT_FAMILY,
            fontSize: '12px',
            lineHeight: '20px',
            color: textColor || '#9ca3af',
            whiteSpace: 'pre-line' as const,
          },
        },
        text ?? '',
      ),
    ),

  /**
   * Order line items. Emits a `{{#each <source>}}…{{/each}}` Handlebars loop
   * (resolved at send time) rendering one styled row per item. The per-item
   * fields are the project's order-item shape: this.title, this.quantity,
   * this.unit_price_formatted, this.line_total_formatted, this.thumbnail.
   * `source`/`showImage`/`currency` are block props baked in at render time.
   */
  LineItems: ({ source, showImage, currency }, key) => {
    const src =
      typeof source === 'string' && source.trim() ? source.trim() : 'order_items';
    const cur = typeof currency === 'string' && currency ? currency : '$';
    const withImage = showImage !== 'no' && showImage !== false;
    const imgCell = withImage
      ? '<td style="padding:15px;width:80px;">{{#if this.thumbnail}}<img src="{{this.thumbnail}}" alt="{{this.title}}" width="80" style="display:block;border-radius:4px;border:0;height:auto;">{{/if}}</td>'
      : '';
    const html =
      `{{#each ${src}}}<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:12px;background-color:#f8f9fa;border-radius:8px;"><tr>` +
      imgCell +
      '<td style="padding:15px;vertical-align:middle;">' +
      '<p style="margin:0 0 5px 0;font-size:16px;color:#333333;font-weight:bold;">{{this.title}}</p>' +
      /*
       * Color entonado. Va ACA, en el bloque generado por codigo, y no en el
       * JSON de cada plantilla: las plantillas viven en la base y varias
       * instancias las tienen editadas a mano, asi que un cambio de markup solo
       * llega a todas por este camino. Con `color_label` ausente (la linea no va
       * entonada) el `{{#if}}` no emite nada.
       *
       * El swatch es una celda de tabla con `background-color` y no un `<span>`
       * con borde redondeado: Outlook ignora `border-radius` y descarta los
       * `display:inline-block`, y un cuadradito que se ve en todos lados es
       * mejor que un circulo que en la mitad de los clientes no aparece.
       */
      '{{#if this.color_label}}<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 5px 0;"><tr>' +
      '<td width="12" height="12" style="width:12px;height:12px;background-color:{{#if this.color_hex}}{{this.color_hex}}{{else}}#d1d5db{{/if}};border:1px solid #e5e7eb;font-size:0;line-height:0;">&nbsp;</td>' +
      '<td style="padding-left:6px;font-size:14px;color:#666666;">Color: {{this.color_label}}</td>' +
      '</tr></table>{{/if}}' +
      `<p style="margin:0;font-size:14px;color:#666666;">{{this.quantity}} x ${cur} {{this.unit_price_formatted}}</p>` +
      '</td>' +
      `<td style="padding:15px;text-align:right;vertical-align:middle;font-size:16px;color:#333333;font-weight:bold;white-space:nowrap;">${cur} {{this.line_total_formatted}}</td>` +
      '</tr></table>{{/each}}';
    return createElement('div', { key, dangerouslySetInnerHTML: { __html: html } });
  },

  /**
   * Sucursal de RETIRO EN TIENDA.
   *
   * El comprador que elige "Retiro en tienda" recibia el mismo mail que el que
   * pide envio a domicilio: confirmacion de la compra y ni una palabra de DONDE
   * la retira. El dato existia —`buildPickupContext` lo arma desde la sucursal
   * elegida en el checkout— y no lo consumia ninguna plantilla.
   *
   * Va por codigo y no como RawHtml en el JSON de cada fila por el mismo motivo
   * que `LineItems`: las plantillas viven en la base y hay instalaciones con el
   * diseno editado a mano, asi que un bloque nuevo solo llega a todas por aca.
   *
   * DOBLE GATE a proposito. `is_store_pickup` dice que la orden es de retiro;
   * `pickup_store` dice que ademas se pudo LEER la sucursal (el contexto la deja
   * ausente cuando la resolucion falla, sin tirar). Gatear solo por el primero
   * imprimiria el encabezado "Retiralo en" sobre una caja vacia, que es peor que
   * no decir nada: el cliente se queda esperando una direccion que no llega.
   *
   * Todo tablas y nada de flex/grid: Outlook las ignora y el bloque se desarma.
   */
  PickupStore: ({ title, showHours, showMap }, key) => {
    const heading =
      typeof title === 'string' && title.trim() ? title.trim() : 'Retiralo en';
    const withHours = showHours !== 'no' && showHours !== false;
    const withMap = showMap !== 'no' && showMap !== false;
    const hours = withHours
      ? '{{#if hours.length}}<tr><td style="padding:8px 15px 0;font-size:14px;color:#666666;">' +
        '<strong style="color:#333333;">Horarios</strong><br>' +
        '{{#each hours}}{{this}}<br>{{/each}}' +
        '</td></tr>{{/if}}'
      : '';
    const map = withMap
      ? '{{#if map_url}}<tr><td style="padding:8px 15px 0;font-size:14px;">' +
        '<a href="{{map_url}}" style="color:{{../primary_color}};text-decoration:underline;">Ver en el mapa</a>' +
        '</td></tr>{{/if}}'
      : '';
    const html =
      '{{#if is_store_pickup}}{{#with pickup_store}}' +
      '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" ' +
      'style="margin:0 0 16px;background-color:#f8f9fa;border-radius:8px;">' +
      `<tr><td style="padding:15px 15px 0;font-size:16px;color:{{../primary_color}};font-weight:bold;">${heading}</td></tr>` +
      '<tr><td style="padding:8px 15px 0;font-size:16px;color:#333333;font-weight:bold;">{{name}}</td></tr>' +
      '{{#if address}}<tr><td style="padding:4px 15px 0;font-size:14px;color:#666666;">{{address}}</td></tr>{{/if}}' +
      '{{#if phone}}<tr><td style="padding:4px 15px 0;font-size:14px;color:#666666;">Tel: {{phone}}</td></tr>{{/if}}' +
      hours +
      map +
      '<tr><td style="height:15px;font-size:0;line-height:0;">&nbsp;</td></tr>' +
      '</table>' +
      '{{/with}}{{/if}}';
    return createElement('div', { key, dangerouslySetInnerHTML: { __html: html } });
  },

  /**
   * Escape hatch for advanced Handlebars (line-item loops, conditionals). The
   * markup is emitted verbatim so `{{#each items}}…{{/each}}` reaches the
   * Handlebars pass intact.
   */
  RawHtml: ({ html }, key) =>
    createElement('div', {
      key,
      dangerouslySetInnerHTML: { __html: typeof html === 'string' ? html : '' },
    }),
};

/** Types already warned about, so one bad design doesn't flood the logs. */
const warnedUnknownTypes = new Set<string>();

/**
 * Fallback for a block whose `type` has no entry in BLOCKS.
 *
 * This used to return `null`: the block vanished from the email and NOTHING said
 * so — not a log line, not a validation error, not a broken preview. The mail
 * went out short a paragraph or a button and the only one who noticed was the
 * customer who could not find the link.
 *
 * A block type can go missing for boring reasons: the admin Puck config
 * (src/admin/lib/puck/email-config.tsx) gains a component and nobody adds the
 * server-side renderer, a block gets renamed on one side only, or a design
 * written by a newer build is rendered by an older one. In every one of those
 * cases DEGRADING beats deleting: emit whatever the props carry, in position.
 *
 * Order matters: `html` first (a RawHtml-shaped block keeps its markup verbatim,
 * so Handlebars still reaches the send-time pass), then `text`. When there is
 * nothing renderable we still leave an HTML comment so the gap is auditable in
 * the sent source instead of invisible.
 */
function degradeUnknownBlock(block: PuckEmailBlock, key: number): ReactNode {
  const type = typeof block?.type === 'string' ? block.type : '(sin tipo)';
  const props = block?.props ?? {};

  if (!warnedUnknownTypes.has(type)) {
    warnedUnknownTypes.add(type);
    console.warn(
      `[email-template] bloque "${type}" sin renderer en render-email.ts — se degrada a RawHtml/Text en su posición. Agregá el renderer en BLOCKS.`,
    );
  }

  // Los `!` son honestos: BLOCKS es `Record<string, BlockRenderer>` y con
  // `noUncheckedIndexedAccess` toda propiedad se lee como `T | undefined`, pero
  // `RawHtml` y `Text` están declarados en el literal (líneas 111 y 296) y son
  // las entradas de fallback CONTRACTUALES de este renderer. Si desaparecen del
  // literal por refactor, el error acá lo captura el compilador — que es lo
  // que hoy no está pasando.
  if (typeof props.html === 'string' && props.html.trim() !== '') {
    return BLOCKS.RawHtml!(props, key);
  }
  if (typeof props.text === 'string' && props.text.trim() !== '') {
    return BLOCKS.Text!(props, key);
  }
  // `-->` inside the type would close the comment early and dump the rest of the
  // document as markup; keep only characters that cannot break out.
  const safeType = type.replace(/[^\w.-]+/g, '_');
  return createElement('div', {
    key,
    dangerouslySetInnerHTML: {
      __html: `<!-- email-template: bloque "${safeType}" sin renderer -->`,
    },
  });
}

/** Build the React Email element tree for a Puck document. */
function buildDocument(doc: PuckEmailDocument): ReactElement {
  const rootProps = doc.root?.props ?? {};
  const pageBackground = rootProps.backgroundColor || '#f3f4f6';
  const contentBackground = rootProps.contentBackground || '#ffffff';
  const width = rootProps.width ? Number(rootProps.width) : 600;

  const blocks = Array.isArray(doc.content) ? doc.content : [];
  const children: ReactNode[] = blocks.map((block, index) => {
    const renderer = block?.type ? BLOCKS[block.type] : undefined;
    // No renderer → degrade in position. Never drop the block: see
    // degradeUnknownBlock().
    return renderer
      ? renderer(block.props ?? {}, index)
      : degradeUnknownBlock(block, index);
  });

  return createElement(
    Html,
    null,
    createElement(
      Body,
      {
        style: {
          backgroundColor: pageBackground,
          margin: '0',
          padding: '24px 0',
          fontFamily: FONT_FAMILY,
        },
      },
      createElement(
        Container,
        {
          style: {
            backgroundColor: contentBackground,
            maxWidth: `${width}px`,
            margin: '0 auto',
            padding: '32px',
            borderRadius: '12px',
          },
        },
        children,
      ),
    ),
  );
}

/**
 * Render a Puck email document to an HTML string. `{{handlebars}}` tokens are
 * preserved for the send-time Handlebars pass. Returns an empty string for an
 * empty/invalid document.
 */
export async function renderPuckEmailHtml(
  design: PuckEmailDocument | null | undefined,
): Promise<string> {
  if (!design || !Array.isArray(design.content) || design.content.length === 0) {
    return '';
  }
  return render(buildDocument(design));
}

export { BLOCKS as EMAIL_BLOCK_RENDERERS };
