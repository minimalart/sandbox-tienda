import type { Config } from '@measured/puck';
import { s3ImageField } from './fields/s3-image-field';

/**
 * Puck editor config for transactional email templates.
 *
 * IMPORTANT: the component NAMES and PROP SHAPES here must stay in sync with the
 * backend renderer (src/modules/email-template/render-email.ts), which is the
 * source of truth that turns this Puck document into email-safe HTML via React
 * Email at save/preview time. The render functions below use inline styles so
 * the in-admin canvas is a faithful-enough WYSIWYG; the real, email-client-safe
 * markup is produced by the backend renderer.
 *
 * Handlebars tokens ({{customer_name}}) can be typed directly into any text
 * field — they are preserved through rendering and resolved at send time. For
 * loops/conditionals ({{#each items}}…{{/each}}) use the "Raw HTML" block.
 */

const FONT_FAMILY =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const alignField = {
  type: 'select' as const,
  label: 'Alineación',
  options: [
    { label: 'Izquierda', value: 'left' },
    { label: 'Centro', value: 'center' },
    { label: 'Derecha', value: 'right' },
  ],
};

type Align = 'left' | 'center' | 'right';
const align = (v: unknown): Align =>
  v === 'center' || v === 'right' ? v : 'left';

/**
 * Whether an image src can actually be shown in the editor canvas. Unresolved
 * Handlebars tokens ({{logo_url}}) are NOT real URLs — rendering them as <img>
 * produces a broken-image icon, so we show a labelled placeholder instead. At
 * send/preview time the token is resolved and the real image loads.
 */
const isRenderableSrc = (src: unknown): src is string =>
  typeof src === 'string' && src.length > 0 && !src.includes('{{');

/**
 * Renders arbitrary email HTML inside an isolated, auto-sized iframe — the same
 * way an email client would. This keeps the markup's own styles (body
 * background, full-width tables, dark footers, font links) contained so they
 * render faithfully and never leak into the admin UI. Legacy raw-HTML templates
 * migrate into a single RawHtml block, so this is also their canvas preview.
 */
function RawHtmlPreview({ html }: { html: string }) {
  const [height, setHeight] = useState(160);
  return (
    <iframe
      title="email-html-block"
      srcDoc={html}
      // allow-same-origin (no scripts) so we can measure the content height;
      // the content is the user's own trusted template.
      sandbox="allow-same-origin"
      onLoad={(e) => {
        try {
          const doc = e.currentTarget.contentWindow?.document;
          if (doc?.body) setHeight(doc.body.scrollHeight + 8);
        } catch {
          /* cross-origin / measurement failed — keep current height */
        }
      }}
      style={{ width: '100%', height, border: 0, display: 'block' }}
    />
  );
}

export const emailPuckConfig: Config = {
  root: {
    fields: {
      backgroundColor: { type: 'text', label: 'Fondo de página' },
      contentBackground: { type: 'text', label: 'Fondo del contenido' },
      width: { type: 'number', label: 'Ancho (px)' },
    },
    defaultProps: {
      backgroundColor: '#f3f4f6',
      contentBackground: '#ffffff',
      width: 600,
    },
    render: ({ children, backgroundColor, contentBackground, width }: any) => (
      // minHeight fills the Puck canvas so the area below the content reads as
      // the email's page background — not an empty dark void.
      <div
        style={{
          backgroundColor: backgroundColor || '#f3f4f6',
          minHeight: '100%',
          padding: '24px 0',
          fontFamily: FONT_FAMILY,
        }}
      >
        <div
          style={{
            backgroundColor: contentBackground || '#ffffff',
            maxWidth: `${Number(width) || 600}px`,
            margin: '0 auto',
            padding: '32px',
            borderRadius: '12px',
          }}
        >
          {children}
        </div>
      </div>
    ),
  },

  components: {
    Heading: {
      label: 'Título',
      fields: {
        text: { type: 'text', label: 'Texto' },
        level: {
          type: 'select',
          label: 'Nivel',
          options: [
            { label: 'H1', value: 'h1' },
            { label: 'H2', value: 'h2' },
            { label: 'H3', value: 'h3' },
          ],
        },
        align: alignField,
        color: { type: 'text', label: 'Color (hex)' },
      },
      defaultProps: { text: 'Título', level: 'h2', align: 'left', color: '' },
      render: ({ text, level, align: a, color }: any) => {
        const Tag = (level === 'h1' || level === 'h3' ? level : 'h2') as any;
        return (
          <Tag
            style={{
              margin: '0 0 16px',
              fontFamily: FONT_FAMILY,
              textAlign: align(a),
              color: color || '#111827',
            }}
          >
            {text}
          </Tag>
        );
      },
    },

    Text: {
      label: 'Texto',
      fields: {
        text: { type: 'textarea', label: 'Contenido' },
        align: alignField,
        color: { type: 'text', label: 'Color (hex)' },
      },
      defaultProps: { text: 'Escribí tu contenido acá.', align: 'left', color: '' },
      render: ({ text, align: a, color }: any) => (
        <p
          style={{
            margin: '0 0 16px',
            fontFamily: FONT_FAMILY,
            fontSize: '14px',
            lineHeight: '24px',
            color: color || '#374151',
            textAlign: align(a),
            whiteSpace: 'pre-line',
          }}
        >
          {text}
        </p>
      ),
    },

    Button: {
      label: 'Botón',
      fields: {
        label: { type: 'text', label: 'Texto del botón' },
        href: { type: 'text', label: 'Link' },
        backgroundColor: { type: 'text', label: 'Color de fondo' },
        textColor: { type: 'text', label: 'Color de texto' },
        align: alignField,
      },
      defaultProps: {
        label: 'Ver más',
        href: '#',
        backgroundColor: '#111827',
        textColor: '#ffffff',
        align: 'left',
      },
      render: ({ label, href, backgroundColor, textColor, align: a }: any) => (
        <div style={{ textAlign: align(a), margin: '0 0 16px' }}>
          <a
            href={href || '#'}
            style={{
              backgroundColor: backgroundColor || '#111827',
              color: textColor || '#ffffff',
              fontFamily: FONT_FAMILY,
              fontSize: '14px',
              fontWeight: 600,
              padding: '12px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            {label}
          </a>
        </div>
      ),
    },

    Image: {
      label: 'Imagen',
      fields: {
        src: s3ImageField('Imagen (URL o subir)'),
        alt: { type: 'text', label: 'Texto alternativo' },
        width: { type: 'number', label: 'Ancho (px)' },
        align: alignField,
      },
      defaultProps: { src: '', alt: '', width: 0, align: 'center' },
      render: ({ src, alt, width, align: a }: any) => (
        <div style={{ textAlign: align(a), margin: '0 0 16px' }}>
          {isRenderableSrc(src) ? (
            <img
              src={src}
              alt={alt}
              width={width ? Number(width) : undefined}
              style={{ maxWidth: '100%', display: 'inline-block', border: 0 }}
            />
          ) : (
            <div
              style={{
                background: '#e5e7eb',
                borderRadius: 8,
                height: 160,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                fontFamily: 'monospace',
                fontSize: 12,
                padding: '0 8px',
              }}
            >
              {typeof src === 'string' && src.includes('{{')
                ? src
                : 'URL de la imagen'}
            </div>
          )}
        </div>
      ),
    },

    Logo: {
      label: 'Logo',
      fields: {
        src: s3ImageField('Logo (URL o subir)'),
        href: { type: 'text', label: 'Link (opcional)' },
        width: { type: 'number', label: 'Ancho (px)' },
        align: alignField,
      },
      defaultProps: { src: '', href: '', width: 180, align: 'center' },
      render: ({ src, href, width, align: a }: any) => {
        const img = isRenderableSrc(src) ? (
          <img
            src={src}
            alt="logo"
            width={width ? Number(width) : 180}
            style={{ display: 'inline-block', border: 0 }}
          />
        ) : (
          <div
            style={{
              background: '#e5e7eb',
              borderRadius: 8,
              width: width ? Number(width) : 180,
              height: 60,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: 12,
              padding: '0 8px',
              fontFamily: 'monospace',
            }}
          >
            {typeof src === 'string' && src.includes('{{') ? src : 'Logo'}
          </div>
        );
        return (
          <div style={{ textAlign: align(a ?? 'center'), margin: '0 0 24px' }}>
            {href ? <a href={href}>{img}</a> : img}
          </div>
        );
      },
    },

    Columns: {
      label: 'Columnas',
      fields: {
        left: { type: 'textarea', label: 'Columna izquierda' },
        right: { type: 'textarea', label: 'Columna derecha' },
      },
      defaultProps: { left: 'Izquierda', right: 'Derecha' },
      render: ({ left, right }: any) => {
        const cell: React.CSSProperties = {
          flex: 1,
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          lineHeight: '24px',
          color: '#374151',
          whiteSpace: 'pre-line',
          padding: '0 8px',
        };
        return (
          <div style={{ display: 'flex', gap: 8, margin: '0 0 16px' }}>
            <div style={cell}>{left}</div>
            <div style={cell}>{right}</div>
          </div>
        );
      },
    },

    Footer: {
      label: 'Footer',
      fields: {
        text: { type: 'textarea', label: 'Texto' },
        backgroundColor: { type: 'text', label: 'Color de fondo' },
        textColor: { type: 'text', label: 'Color de texto' },
      },
      defaultProps: {
        text: '© {{cde_display_name}} · Todos los derechos reservados',
        backgroundColor: 'transparent',
        textColor: '#9ca3af',
      },
      render: ({ text, backgroundColor, textColor }: any) => (
        <div
          style={{
            backgroundColor: backgroundColor || 'transparent',
            padding: '24px 16px',
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: FONT_FAMILY,
              fontSize: 12,
              lineHeight: '20px',
              color: textColor || '#9ca3af',
              whiteSpace: 'pre-line',
            }}
          >
            {text}
          </p>
        </div>
      ),
    },

    Divider: {
      label: 'Separador',
      fields: {},
      defaultProps: {},
      render: () => (
        <hr style={{ borderColor: '#e5e7eb', margin: '16px 0' }} />
      ),
    },

    Spacer: {
      label: 'Espacio',
      fields: { size: { type: 'number', label: 'Alto (px)' } },
      defaultProps: { size: 24 },
      render: ({ size }: any) => (
        <div style={{ height: `${Number(size) || 24}px` }} />
      ),
    },

    LineItems: {
      label: 'Lista de productos',
      fields: {
        source: { type: 'text', label: 'Variable del array (ej: order_items)' },
        showImage: {
          type: 'radio',
          label: 'Mostrar imagen',
          options: [
            { label: 'Sí', value: 'yes' },
            { label: 'No', value: 'no' },
          ],
        },
        currency: { type: 'text', label: 'Símbolo de moneda' },
      },
      defaultProps: { source: 'order_items', showImage: 'yes', currency: '$' },
      // Canvas shows static sample rows (real data resolves at send/preview).
      render: ({ showImage, currency }: any) => {
        const cur = currency || '$';
        const withImage = showImage !== 'no';
        const sample = [
          { title: 'Producto de ejemplo', qty: 2, unit: '1.500', total: '3.000' },
          { title: 'Otro producto', qty: 1, unit: '900', total: '900' },
        ];
        return (
          <div style={{ margin: '0 0 16px' }}>
            {sample.map((it, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#f8f9fa',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                {withImage && (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 4,
                      background: '#e5e7eb',
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, fontFamily: FONT_FAMILY }}>
                  <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#333' }}>
                    {it.title}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                    {it.qty} x {cur} {it.unit}
                  </p>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#333', whiteSpace: 'nowrap', fontFamily: FONT_FAMILY }}>
                  {cur} {it.total}
                </div>
              </div>
            ))}
            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
              {`{{#each ${'order_items'}}} · datos reales al enviar`}
            </p>
          </div>
        );
      },
    },

    RawHtml: {
      label: 'HTML / Handlebars',
      fields: {
        html: { type: 'textarea', label: 'HTML (admite {{#each}}, {{#if}})' },
      },
      defaultProps: {
        html: '<p>{{#each items}} ... {{/each}}</p>',
      },
      // Render the HTML in an isolated iframe for a faithful WYSIWYG canvas.
      // Handlebars tokens ({{#each}}) appear as literal text here since data is
      // only resolved at send/preview time.
      render: ({ html }: any) =>
        typeof html === 'string' && html.length ? (
          <RawHtmlPreview html={html} />
        ) : (
          <div
            style={{
              border: '1px dashed #d1d5db',
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              color: '#9ca3af',
              textAlign: 'center',
            }}
          >
            HTML / Handlebars
          </div>
        ),
    },
  },
};

export default emailPuckConfig;
