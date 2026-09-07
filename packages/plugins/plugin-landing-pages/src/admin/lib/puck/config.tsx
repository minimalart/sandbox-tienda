import type { Config } from '@measured/puck';

/**
 * Puck editor config for landing pages.
 *
 * IMPORTANT: the component NAMES and PROP SHAPES here must stay in sync with the
 * storefront renderer (apps/storefront/.../landing-renderer.tsx). The render
 * functions below use inline styles so the in-admin preview is self-contained
 * (the storefront's Tailwind / CSS variables are not loaded in the admin) — the
 * real, on-brand styling is applied by the storefront renderer at runtime.
 */

const accent = '#2e7d32';
const wrap: React.CSSProperties = {
  maxWidth: 1024,
  margin: '0 auto',
  padding: '24px 24px',
};

/**
 * Selector de color reutilizable para los bloques: muestra una muestra (swatch
 * nativo) + un input hex/CSS y un botón para volver a "auto" (vacío = usa el
 * color por defecto del tema). Vacío NO fuerza ningún color en el storefront.
 */
const ColorInput = ({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string) => void;
}) => {
  const v = value ?? '';
  const swatch = /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#000000';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="color"
        value={swatch}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 36,
          height: 32,
          padding: 0,
          border: '1px solid #d1d5db',
          borderRadius: 6,
          background: 'none',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      />
      <input
        type="text"
        value={v}
        placeholder="auto"
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          minWidth: 0,
          height: 32,
          padding: '0 8px',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          fontSize: 13,
        }}
      />
      {v ? (
        <button
          type="button"
          onClick={() => onChange('')}
          title="Auto (sin color)"
          style={{
            height: 32,
            padding: '0 8px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
            color: '#6b7280',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
};

const colorField = (label: string) =>
  ({
    type: 'custom' as const,
    label,
    render: ({ onChange, value, field }: any) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {field?.label ?? label}
        </span>
        <ColorInput value={value} onChange={onChange} />
      </div>
    ),
  }) as any;

// Campos de color compartidos: fondo + texto.
const bgFgFields = {
  background: colorField('Background color'),
  textColor: colorField('Text color'),
};

export const config: Config = {
  components: {
    Hero: {
      label: 'Hero',
      fields: {
        title: { type: 'text', label: 'Title' },
        subtitle: { type: 'textarea', label: 'Subtitle' },
        image: { type: 'text', label: 'Background image URL' },
        ctaLabel: { type: 'text', label: 'Button label' },
        ctaHref: { type: 'text', label: 'Button link' },
        ...bgFgFields,
        accentColor: colorField('Button color'),
      },
      defaultProps: {
        title: 'Título principal',
        subtitle: 'Subtítulo descriptivo de la landing.',
        image: '',
        ctaLabel: '',
        ctaHref: '',
        background: '',
        textColor: '',
        accentColor: '',
      },
      render: ({
        title,
        subtitle,
        image,
        ctaLabel,
        ctaHref,
        background,
        textColor,
        accentColor,
      }: any) => (
        <section
          style={{
            position: 'relative',
            minHeight: 280,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            textAlign: 'center',
            padding: '64px 24px',
            background: image
              ? `url(${image}) center/cover`
              : background || '#f3f4f6',
          }}
        >
          {/* Overlay para contraste del texto superpuesto (espeja el storefront). */}
          {image ? (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.4), rgba(0,0,0,0.6))',
              }}
            />
          ) : null}
          {title ? (
            <h1
              style={{
                position: 'relative',
                fontSize: 44,
                fontWeight: 700,
                margin: 0,
                color: textColor || (image ? '#fff' : undefined),
              }}
            >
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p
              style={{
                position: 'relative',
                fontSize: 18,
                color:
                  textColor || (image ? 'rgba(255,255,255,0.9)' : '#4b5563'),
                maxWidth: 640,
              }}
            >
              {subtitle}
            </p>
          ) : null}
          {ctaLabel && ctaHref ? (
            <span
              style={{
                position: 'relative',
                background: accentColor || accent,
                color: '#fff',
                padding: '12px 24px',
                borderRadius: 999,
                fontWeight: 600,
              }}
            >
              {ctaLabel}
            </span>
          ) : null}
        </section>
      ),
    },

    RichText: {
      label: 'Rich text',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        text: { type: 'textarea', label: 'Text' },
        ...bgFgFields,
      },
      defaultProps: {
        heading: '',
        text: 'Escribí tu contenido acá.',
        background: '',
        textColor: '',
      },
      render: ({ heading, text, background, textColor }: any) => (
        <div style={{ ...wrap, background: background || undefined }}>
          {heading ? (
            <h2 style={{ fontSize: 24, fontWeight: 600, color: textColor || undefined }}>
              {heading}
            </h2>
          ) : null}
          <p
            style={{
              color: textColor || '#374151',
              whiteSpace: 'pre-line',
              lineHeight: 1.6,
            }}
          >
            {text}
          </p>
        </div>
      ),
    },

    ImageBlock: {
      label: 'Image',
      fields: {
        src: { type: 'text', label: 'Image URL' },
        alt: { type: 'text', label: 'Alt text' },
        caption: { type: 'text', label: 'Caption' },
        ...bgFgFields,
      },
      defaultProps: { src: '', alt: '', caption: '', background: '', textColor: '' },
      render: ({ src, alt, caption, background, textColor }: any) => (
        <figure style={{ ...wrap, background: background || undefined }}>
          {src ? (
            <img
              src={src}
              alt={alt}
              style={{ width: '100%', borderRadius: 16, display: 'block' }}
            />
          ) : (
            <div
              style={{
                background: '#e5e7eb',
                borderRadius: 16,
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
              }}
            >
              Image URL
            </div>
          )}
          {caption ? (
            <figcaption
              style={{ textAlign: 'center', color: textColor || '#6b7280', marginTop: 8 }}
            >
              {caption}
            </figcaption>
          ) : null}
        </figure>
      ),
    },

    CTA: {
      label: 'CTA',
      fields: {
        title: { type: 'text', label: 'Title' },
        description: { type: 'textarea', label: 'Description' },
        buttonLabel: { type: 'text', label: 'Button label' },
        buttonHref: { type: 'text', label: 'Button link' },
        ...bgFgFields,
        accentColor: colorField('Button color'),
      },
      defaultProps: {
        title: '¿Listo para empezar?',
        description: '',
        buttonLabel: 'Comprar ahora',
        buttonHref: '/store',
        background: '',
        textColor: '',
        accentColor: '',
      },
      render: ({
        title,
        description,
        buttonLabel,
        buttonHref,
        background,
        textColor,
        accentColor,
      }: any) => (
        <section style={wrap}>
          <div
            style={{
              background: background || 'rgba(46,125,50,0.06)',
              borderRadius: 24,
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            {title ? (
              <h2 style={{ fontSize: 24, fontWeight: 700, color: textColor || undefined }}>
                {title}
              </h2>
            ) : null}
            {description ? (
              <p style={{ color: textColor || '#4b5563' }}>{description}</p>
            ) : null}
            {buttonLabel && buttonHref ? (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 8,
                  background: accentColor || accent,
                  color: '#fff',
                  padding: '12px 24px',
                  borderRadius: 999,
                  fontWeight: 600,
                }}
              >
                {buttonLabel}
              </span>
            ) : null}
          </div>
        </section>
      ),
    },

    FAQ: {
      label: 'FAQ',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        items: {
          type: 'array',
          label: 'Questions',
          arrayFields: {
            q: { type: 'text', label: 'Question' },
            a: { type: 'textarea', label: 'Answer' },
          },
          defaultItemProps: { q: 'Pregunta', a: 'Respuesta' },
        },
        ...bgFgFields,
      },
      defaultProps: { heading: 'Preguntas frecuentes', items: [], background: '', textColor: '' },
      render: ({ heading, items, background, textColor }: any) => (
        <section style={{ ...wrap, background: background || undefined }}>
          {heading ? (
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16, color: textColor || undefined }}>
              {heading}
            </h2>
          ) : null}
          {(items ?? []).map((item: any, i: number) => (
            <details
              key={i}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 16,
                marginBottom: 8,
              }}
            >
              <summary style={{ fontWeight: 500, cursor: 'pointer', color: textColor || undefined }}>
                {item.q}
              </summary>
              <p style={{ color: textColor || '#4b5563', whiteSpace: 'pre-line' }}>{item.a}</p>
            </details>
          ))}
        </section>
      ),
    },

    Testimonials: {
      label: 'Testimonials',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        items: {
          type: 'array',
          label: 'Testimonials',
          arrayFields: {
            quote: { type: 'textarea', label: 'Quote' },
            author: { type: 'text', label: 'Author' },
          },
          defaultItemProps: { quote: 'Excelente.', author: 'Cliente' },
        },
        ...bgFgFields,
      },
      defaultProps: { heading: 'Testimonios', items: [], background: '', textColor: '' },
      render: ({ heading, items, background, textColor }: any) => (
        <section style={{ ...wrap, background: background || undefined }}>
          {heading ? (
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16, color: textColor || undefined }}>
              {heading}
            </h2>
          ) : null}
          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            {(items ?? []).map((item: any, i: number) => (
              <blockquote
                key={i}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 16,
                  padding: 20,
                  margin: 0,
                }}
              >
                <p style={{ fontStyle: 'italic', color: textColor || '#374151' }}>
                  “{item.quote}”
                </p>
                {item.author ? (
                  <footer style={{ fontWeight: 600, marginTop: 12, color: textColor || undefined }}>
                    — {item.author}
                  </footer>
                ) : null}
              </blockquote>
            ))}
          </div>
        </section>
      ),
    },

    CollectionGrid: {
      label: 'Collection grid',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        items: {
          type: 'array',
          label: 'Collections',
          arrayFields: {
            label: { type: 'text', label: 'Label' },
            handle: { type: 'text', label: 'Category handle' },
            href: { type: 'text', label: 'Custom link (optional)' },
          },
          defaultItemProps: { label: 'Categoría', handle: '', href: '' },
        },
        ...bgFgFields,
      },
      defaultProps: { heading: 'Comprá por categoría', items: [], background: '', textColor: '' },
      render: ({ heading, items, background, textColor }: any) => (
        <section style={{ ...wrap, background: background || undefined }}>
          {heading ? (
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16, color: textColor || undefined }}>
              {heading}
            </h2>
          ) : null}
          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            }}
          >
            {(items ?? []).map((item: any, i: number) => (
              <div
                key={i}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 16,
                  padding: '40px 16px',
                  textAlign: 'center',
                  fontWeight: 500,
                  color: textColor || undefined,
                }}
              >
                {item.label || item.handle}
              </div>
            ))}
          </div>
        </section>
      ),
    },

    ProductGrid: {
      label: 'Product grid',
      fields: {
        heading: { type: 'text', label: 'Heading' },
        href: { type: 'text', label: 'Link' },
        ctaLabel: { type: 'text', label: 'Button label' },
        ...bgFgFields,
      },
      defaultProps: {
        heading: 'Productos destacados',
        href: '/store',
        ctaLabel: 'Ver productos',
        background: '',
        textColor: '',
      },
      render: ({ heading, ctaLabel, background, textColor }: any) => (
        <section style={{ ...wrap, textAlign: 'center', background: background || undefined }}>
          {heading ? (
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12, color: textColor || undefined }}>
              {heading}
            </h2>
          ) : null}
          <span
            style={{
              display: 'inline-block',
              border: '1px solid #d1d5db',
              borderRadius: 999,
              padding: '12px 24px',
              fontWeight: 600,
              color: textColor || undefined,
            }}
          >
            {ctaLabel}
          </span>
        </section>
      ),
    },

    ProductsList: {
      label: 'Lista de productos (Typesense)',
      fields: {
        heading: { type: 'text', label: 'Título' },
        source: {
          type: 'select',
          label: 'Qué traer',
          options: [
            { label: 'Novedades (más recientes)', value: 'newest' },
            { label: 'Con promoción activa', value: 'promotions' },
            { label: 'Por categoría', value: 'category' },
            { label: 'Por colección', value: 'collection' },
            { label: 'Por tag', value: 'tag' },
            { label: 'Búsqueda libre', value: 'query' },
          ],
        },
        value: {
          type: 'text',
          label: 'Valor (categoría / colección / tag / búsqueda)',
        },
        limit: { type: 'number', label: 'Cantidad (1-24)' },
        sortBy: {
          type: 'select',
          label: 'Orden',
          options: [
            { label: 'Por defecto', value: '' },
            { label: 'Más recientes', value: 'created_at' },
            { label: 'Precio: menor a mayor', value: 'price_asc' },
            { label: 'Precio: mayor a menor', value: 'price_desc' },
            { label: 'Relevancia', value: 'relevance' },
          ],
        },
        ctaLabel: { type: 'text', label: 'Texto del botón (opcional)' },
        href: { type: 'text', label: 'Link del botón (opcional)' },
        ...bgFgFields,
      },
      defaultProps: {
        heading: 'Productos',
        source: 'newest',
        value: '',
        limit: 8,
        sortBy: '',
        ctaLabel: '',
        href: '',
        background: '',
        textColor: '',
      },
      render: ({ heading, source, value, limit, background, textColor }: any) => {
        const sourceLabels: Record<string, string> = {
          newest: 'Novedades',
          promotions: 'Con promoción activa',
          category: `Categoría: ${value || '—'}`,
          collection: `Colección: ${value || '—'}`,
          tag: `Tag: ${value || '—'}`,
          query: `Búsqueda: ${value || '—'}`,
        };
        const count = Math.min(Math.max(Number(limit) || 8, 1), 24);
        return (
          <section style={{ ...wrap, background: background || undefined }}>
            {heading ? (
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: textColor || undefined }}>
                {heading}
              </h2>
            ) : null}
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              {sourceLabels[source] ?? 'Novedades'} · {count} productos · se
              cargan desde Typesense en el sitio
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
              }}
            >
              {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px dashed #d1d5db',
                    borderRadius: 8,
                    background: '#f9fafb',
                    aspectRatio: '3 / 4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    fontSize: 11,
                  }}
                >
                  producto
                </div>
              ))}
            </div>
          </section>
        );
      },
    },

    Spacer: {
      label: 'Spacer',
      fields: {
        size: { type: 'number', label: 'Height (px)' },
        background: colorField('Background color'),
      },
      defaultProps: { size: 32, background: '' },
      render: ({ size, background }: any) => (
        <div style={{ height: `${Number(size) || 32}px`, background: background || undefined }} />
      ),
    },
  },
};

export default config;
