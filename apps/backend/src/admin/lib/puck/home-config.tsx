import type { Config } from '@measured/puck';
import { config as landingConfig } from './config';
import { s3ImageField } from './fields/s3-image-field';

/**
 * Config del editor Puck del home de un demo ("Personalizar home").
 *
 * Los bloques son las SECCIONES REALES del home. Dos tipos:
 *  - Editables (config): sus `props` son el contenido (título, cards, filtro de
 *    productos…). El storefront monta el componente REAL de la sección pasándole
 *    ese contenido como `config` (con estilo real).
 *  - Media: banners, marcas, videos, shop-by-look. El editor las ubica/reordena
 *    y edita el ENCABEZADO de la sección (título/bajada); los ítems (logos,
 *    videos, looks, banners) se editan en sus pantallas (Banners, Marcas,
 *    Videos, Shop by Look), scopeados al canal del demo.
 *
 * El `render` de admin es una tarjeta representativa (el admin no carga el CSS ni
 * los datos del storefront); la edición real es por los `fields` del panel y el
 * resultado real se ve en /demo/{slug}. Los bloques genéricos (Rich text/Imagen/
 * CTA/Spacer) y el Hero editable se reusan de la config de landings.
 */

const generic = landingConfig.components as Record<string, any>;

// ─── Preview card (admin) ────────────────────────────────────────────────────
const card: React.CSSProperties = {
  maxWidth: 1024,
  margin: '0 auto',
  padding: '18px 20px',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};
const badge = (text: string, color = '#2563eb', bg = '#eff6ff'): React.CSSProperties => ({
  alignSelf: 'flex-start',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color,
  background: bg,
  borderRadius: 999,
  padding: '2px 8px',
});
const skeletonRow = (n: number) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 10 }}>
    {Array.from({ length: n }).map((_, i) => (
      <div
        key={i}
        style={{ aspectRatio: '3 / 4', borderRadius: 10, background: '#f3f4f6', border: '1px dashed #e5e7eb' }}
      />
    ))}
  </div>
);

const SectionCard = ({
  label,
  note,
  media,
  props,
}: {
  label: string;
  note?: string;
  media?: React.ReactNode;
  props?: Record<string, any>;
}) => (
  <section style={card}>
    <span style={badge('#2563eb')}>Sección real</span>
    <strong style={{ fontSize: 16, color: '#0f172a' }}>
      {props?.title || props?.heading || label}
    </strong>
    {note ? <span style={{ fontSize: 12, color: '#64748b' }}>{note}</span> : null}
    {media}
  </section>
);

const PlaceCard = ({
  label,
  note,
  subtitle,
}: {
  label: string;
  note: string;
  subtitle?: string;
}) => (
  <section style={{ ...card, background: '#f8fafc', borderStyle: 'dashed' }}>
    <span style={badge('#7c3aed', '#f5f3ff')}>Sección (contenido en su pantalla)</span>
    <strong style={{ fontSize: 16, color: '#0f172a' }}>{label}</strong>
    {subtitle ? <span style={{ fontSize: 13, color: '#334155' }}>{subtitle}</span> : null}
    <span style={{ fontSize: 12, color: '#64748b' }}>{note}</span>
  </section>
);

// ─── Field builders ──────────────────────────────────────────────────────────
const text = (label: string) => ({ type: 'text' as const, label });
const textarea = (label: string) => ({ type: 'textarea' as const, label });
// `min`/`max` los aplica el input del panel: sin eso el spinner baja de 1 y deja
// guardado un número negativo (un `limit: -9` rompía la búsqueda de la fila).
const number = (label: string, min?: number, max?: number) => ({
  type: 'number' as const,
  label,
  ...(min !== undefined ? { min } : {}),
  ...(max !== undefined ? { max } : {}),
});
const select = (label: string, options: { label: string; value: string }[]) => ({
  type: 'select' as const,
  label,
  options,
});

const SOURCE_OPTIONS = [
  { label: 'Novedades (no pisa el preset)', value: 'newest' },
  { label: 'Con promoción activa', value: 'promotions' },
  { label: 'Búsqueda libre', value: 'query' },
  { label: 'Por tag', value: 'tag' },
];

/**
 * ¿El bloque define una búsqueda propia? Con `promotions`, `query` o `tag` (con
 * valor) la búsqueda del bloque REEMPLAZA al filtro del preset del template;
 * `newest` es el neutro y deja ganar al preset.
 *
 * Espeja `hasBlockSearch` del storefront
 * (`apps/storefront/src/modules/home/components/home-renderer/index.tsx`).
 */
const hasBlockSearch = (p: any): boolean => {
  if (p?.source === 'promotions') return true;
  if (p?.source === 'query' || p?.source === 'tag') {
    return typeof p.value === 'string' && p.value.trim().length > 0;
  }
  return false;
};

const SORT_OPTIONS = [
  { label: 'Por defecto (el del preset)', value: '' },
  { label: 'Ranking comercial', value: 'ranking' },
  { label: 'Más recientes', value: 'created_at' },
  { label: 'Precio: menor a mayor', value: 'price_asc' },
  { label: 'Precio: mayor a menor', value: 'price_desc' },
];
const SHOP_BY_LOOK_SLOTS = [
  { label: 'Arriba de todo', value: 'top' },
  { label: 'Después de categorías', value: 'after_collections' },
  { label: 'Después de destacados', value: 'after_featured' },
  { label: 'Antes del footer', value: 'before_footer' },
];

// ─── Componentes ─────────────────────────────────────────────────────────────

const CAMPAIGN_BADGE_ICON_OPTIONS = [
  { label: 'Tarjeta de crédito', value: 'credit-card' },
  { label: 'Sucursal / retiro', value: 'store' },
  { label: 'Garantía / escudo', value: 'shield' },
  { label: 'Envío / camión', value: 'truck' },
  { label: 'Reloj / plazo', value: 'clock' },
  { label: 'Destello / novedad', value: 'sparkles' },
  { label: 'Regalo', value: 'gift' },
  { label: 'Educación', value: 'graduation-cap' },
];

export const homeConfig: Config = {
  categories: {
    generales: { title: 'Generales', components: ['Hero', 'RichText', 'ImageBlock', 'CTA', 'Spacer'] },
    grocery: {
      title: 'Secciones del home',
      components: [
        'Categorias',
        'ProductosDestacados',
        'Combos',
        'BundlesGrid',
        'BannerPromo',
        'MasCategorias',
        'Blog',
        'Banners',
        'Marcas',
        'Videos',
        'ShopByLook',
      ],
    },
    campaign: {
      title: 'Campaña (landing institucional)',
      components: ['CampaignHero', 'ProductosDestacados', 'BundlesGrid'],
    },
  },
  components: {
    // Genéricos (reuso de landings)
    Hero: generic.Hero,
    RichText: generic.RichText,
    ImageBlock: generic.ImageBlock,
    CTA: generic.CTA,
    Spacer: generic.Spacer,

    // ── Categorías (Comprá por categoría) → CollectionsSection ──────────────
    Categorias: {
      label: 'Comprá por categoría',
      fields: {
        title: text('Título'),
        subtitle: text('Subtítulo'),
        collections: {
          type: 'array',
          label: 'Tarjetas de categoría',
          arrayFields: {
            label: text('Nombre'),
            image: s3ImageField('URL de imagen'),
            href: text('Link (ej: /store?category=frescos)'),
            backgroundColor: text('Color de fondo (hex, opcional)'),
            backgroundImage: s3ImageField('Imagen de fondo (opcional — pisa el color)'),
          },
          defaultItemProps: { label: 'Categoría', image: '', href: '/store', backgroundColor: '', backgroundImage: '' },
        },
        viewAllTitle: text('Card "ver todo" — título (opcional)'),
        viewAllHref: text('Card "ver todo" — link'),
      },
      defaultProps: { title: 'Comprá por categoría', subtitle: '', collections: [], viewAllTitle: '', viewAllHref: '/store' },
      render: (p: any) => (
        <SectionCard label="Comprá por categoría" props={p} note={`${(p.collections ?? []).length} tarjetas`} media={skeletonRow(4)} />
      ),
    },

    // ── Fila de productos → FeaturedProductsGrid ───────────────────────────
    ProductosDestacados: {
      label: 'Fila de productos',
      fields: {
        preset: select('Contenido', [
          { label: 'Destacados (del template)', value: 'featuredProducts' },
          { label: 'Novedades (del template)', value: 'novedades' },
          { label: 'Destacados del mes (del template)', value: 'destacadosDelMes' },
          { label: 'Promos (del template)', value: 'renovaEnergia' },
          { label: 'Personalizado (elegir de Typesense)', value: 'custom' },
        ]),
        title: text('Título (override, opcional)'),
        mobileTitle: text('Título en mobile (opcional)'),
        description: textarea('Bajada (opcional — vacío = sin bajada)'),
        source: select('Qué traer (pisa el contenido del preset)', SOURCE_OPTIONS),
        value: text('Valor (búsqueda libre o tag)'),
        limit: number('Cantidad (vacío = la del preset)', 1, 48),
        sortBy: select('Orden', SORT_OPTIONS),
        cardVariant: select('Tarjeta', [
          { label: 'Normal', value: 'default' },
          { label: 'Compacta', value: 'compact' },
        ]),
        layout: select('Presentación', [
          { label: 'Carrusel', value: 'carousel' },
          { label: 'Grilla de 4', value: 'grid-4' },
        ]),
        withBundles: select('Kits de la tienda', [
          { label: 'Primero los kits, después los productos', value: 'yes' },
          { label: 'Solo productos', value: 'no' },
        ]),
        viewAllLabel: text('Botón "ver todas" — texto (opcional)'),
        viewAllHref: text('Botón "ver todas" — link'),
      },
      defaultProps: {
        preset: 'featuredProducts',
        title: '',
        mobileTitle: '',
        description: '',
        source: 'newest',
        value: '',
        // Sin `limit`: vacío = la cantidad del preset del template (y 12 cuando
        // el contenido es Personalizado). Sembrar 12 acá haría que cada bloque
        // pise el limit del preset con un 12 que el usuario nunca eligió.
        sortBy: '',
        cardVariant: 'default',
        layout: 'carousel',
        // Los kits publicados de la tienda abren la fila (PRD Bundles V2 §40):
        // una tienda sin kits no ve nada distinto, y la que no los quiere en
        // ESTA fila lo apaga acá.
        withBundles: 'yes',
        viewAllLabel: '',
        viewAllHref: '/store',
      },
      render: (p: any) => (
        <SectionCard
          label="Fila de productos"
          props={p}
          note={
            // Describe lo que va a traer DE VERDAD: la búsqueda del bloque gana
            // sobre el preset del template.
            hasBlockSearch(p) || p.preset === 'custom'
              ? `Typesense · ${p.source ?? 'newest'}${p.value ? `: ${p.value}` : ''} · ${p.limit || 12} productos`
              : [
                  `Contenido del template: ${p.preset ?? 'featuredProducts'}`,
                  p.limit ? `${p.limit} productos` : null,
                  p.sortBy ? `orden: ${p.sortBy}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
          }
          media={skeletonRow(4)}
        />
      ),
    },

    // ── Combos / Emprendedores → EntrepreneurBanner ────────────────────────
    Combos: {
      label: 'Combos / Emprendedores',
      fields: {
        title: text('Título'),
        description: textarea('Descripción'),
        kits: {
          type: 'array',
          label: 'Combos (requieren video + poster)',
          arrayFields: {
            title: text('Título'),
            subtitle: text('Subtítulo'),
            image: s3ImageField('Imagen chica'),
            video: text('URL video (mp4)'),
            poster: s3ImageField('Poster del video'),
            bgColor: text('Color de fondo (hex)'),
            href: text('Link'),
          },
          defaultItemProps: { title: 'Combo', subtitle: '', image: '', video: '', poster: '', bgColor: '#0a3d2e', href: '/store' },
        },
      },
      defaultProps: { title: 'Combos y cajas', description: '', kits: [] },
      render: (p: any) => (
        <SectionCard label="Combos / Emprendedores" props={p} note={`${(p.kits ?? []).length} combos`} media={skeletonRow(2)} />
      ),
    },

    // ── BundlesGrid → grid de bundles publicados ───────────────────────────
    // Requiere `content_config.sections.bundles === true` en la tienda; sin
    // eso el renderer del storefront omite el bloque. Los bundles vienen del
    // backend scopeados por publishable key: si `handles` está vacío se
    // muestran TODOS los publicados de la tienda; si tiene contenido, esa
    // lista pisa el default y respeta el orden ingresado.
    BundlesGrid: {
      label: 'Bundles (kits configurables)',
      fields: {
        title: text('Título'),
        subtitle: textarea('Bajada (opcional)'),
        limit: number('Cantidad máxima (vacío = 6)', 1, 24),
        handles: {
          type: 'array',
          label: 'Handles específicos (opcional — vacío = todos los publicados)',
          arrayFields: {
            handle: text('Handle del bundle'),
          },
          defaultItemProps: { handle: '' },
        },
        viewAllLabel: text('Botón "ver todos" — texto (opcional)'),
        viewAllHref: text('Botón "ver todos" — link (default /bundles)'),
      },
      defaultProps: {
        title: 'Armá tu kit',
        subtitle: '',
        limit: 6,
        handles: [],
        viewAllLabel: '',
        viewAllHref: '/bundles',
      },
      render: (p: any) => (
        <SectionCard
          label="Bundles (kits configurables)"
          props={p}
          note={
            (p.handles ?? []).length > 0
              ? `${(p.handles ?? []).length} handle(s) fijos`
              : 'Todos los publicados de la tienda'
          }
          media={skeletonRow(3)}
        />
      ),
    },

    // ── Banner con imagen → PromoBanner ────────────────────────────────────
    BannerPromo: {
      label: 'Banner con imagen',
      fields: {
        title: text('Título'),
        subtitle: textarea('Bajada (opcional)'),
        ctaLabel: text('Botón — texto (vacío = sin botón)'),
        ctaHref: text('Botón — link'),
        image: s3ImageField('Imagen del banner'),
        imagePosition: select('Lado de la imagen', [
          { label: 'Derecha', value: 'right' },
          { label: 'Izquierda', value: 'left' },
        ]),
        backgroundColor: text('Color de fondo (hex)'),
        textColor: text('Color del texto (hex, opcional)'),
        accentColor: text('Color del botón (hex, opcional — vacío = color de marca)'),
      },
      defaultProps: {
        title: 'Título del banner',
        subtitle: '',
        ctaLabel: 'Ver más',
        ctaHref: '/store',
        image: '',
        imagePosition: 'right',
        backgroundColor: '#EAF0E8',
        textColor: '',
        accentColor: '',
      },
      // Preview representativa: el mismo reparto (texto de un lado, imagen del
      // otro) con los colores elegidos, para que se entienda sin abrir el demo.
      render: (p: any) => (
        <section style={card}>
          <span style={badge('#2563eb')}>Sección real</span>
          <div
            style={{
              display: 'flex',
              flexDirection: p.imagePosition === 'left' ? 'row-reverse' : 'row',
              alignItems: 'stretch',
              borderRadius: 16,
              overflow: 'hidden',
              background: p.backgroundColor || '#EAF0E8',
            }}
          >
            <div style={{ flex: 1, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <strong style={{ fontSize: 18, color: p.textColor || '#0f172a' }}>
                {p.title || 'Título del banner'}
              </strong>
              {p.subtitle ? (
                <span style={{ fontSize: 13, color: p.textColor || '#475569' }}>{p.subtitle}</span>
              ) : null}
              {p.ctaLabel ? (
                <span
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: 8,
                    borderRadius: 999,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                    background: p.accentColor || '#0f172a',
                  }}
                >
                  {p.ctaLabel}
                </span>
              ) : null}
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 140,
                background: p.image ? `center / cover no-repeat url("${p.image}")` : '#f3f4f6',
                border: p.image ? undefined : '1px dashed #e5e7eb',
              }}
            />
          </div>
        </section>
      ),
    },

    // ── Más categorías → MoreProductsSection ───────────────────────────────
    MasCategorias: {
      label: 'Conocé más categorías',
      fields: {
        title: text('Título'),
        subtitle: text('Subtítulo'),
        items: {
          type: 'array',
          label: 'Tarjetas',
          arrayFields: {
            label: text('Nombre'),
            image: s3ImageField('URL de imagen'),
            href: text('Link'),
            backgroundColor: text('Color de fondo (hex, opcional)'),
          },
          defaultItemProps: { label: 'Categoría', image: '', href: '/store', backgroundColor: '' },
        },
        viewAllTitle: text('Card "ver todo" — título (opcional)'),
        viewAllHref: text('Card "ver todo" — link'),
      },
      defaultProps: { title: 'Conocé más categorías', subtitle: '', items: [], viewAllTitle: '', viewAllHref: '/store' },
      render: (p: any) => (
        <SectionCard label="Conocé más categorías" props={p} note={`${(p.items ?? []).length} tarjetas`} media={skeletonRow(6)} />
      ),
    },

    // ── Notas del blog → BlogHighlights ────────────────────────────────────
    Blog: {
      label: 'Notas del blog',
      fields: {
        title: text('Título'),
        subtitle: textarea('Subtítulo'),
        featuredCtaLabel: text('Botón de la nota destacada'),
        ctaLabel: text('Botón de la otra nota'),
        viewAllLabel: text('Link "ver todas" (vacío = no se muestra)'),
      },
      defaultProps: {
        title: '',
        subtitle: '',
        featuredCtaLabel: 'Leer nota',
        ctaLabel: 'Leer nota',
        viewAllLabel: 'Ver todas las notas',
      },
      render: (p: any) => (
        <SectionCard
          label="Notas del blog"
          props={p}
          note="Las 2 últimas notas del blog del demo (destacada + secundaria). Los artículos se editan en la pantalla Blog."
          media={skeletonRow(2)}
        />
      ),
    },

    // ── Media: el CONTENIDO se edita en su pantalla; el título y la bajada de
    // la sección sí se editan acá (vacío = se oculta / se usa el del template).
    Banners: {
      label: 'Hero (banners)',
      fields: {},
      defaultProps: {},
      render: () => <PlaceCard label="Hero (banners)" note="Carrusel de banners del demo. El título y la bajada de cada banner se editan en la pantalla Banners." />,
    },
    Marcas: {
      label: 'Marcas',
      fields: {
        title: text('Título (vacío = ocultar el título)'),
        subtitle: textarea('Bajada (opcional)'),
      },
      defaultProps: {},
      render: (p: any) => (
        <PlaceCard
          label={p.title ?? 'Nuestras marcas'}
          note="Logos de marcas del demo. Editá los logos en la pantalla Marcas."
          subtitle={p.subtitle}
        />
      ),
    },
    Videos: {
      label: 'Videos',
      fields: {
        title: text('Título (vacío = el del template)'),
        mobileTitle: text('Título en mobile (opcional)'),
        description: textarea('Bajada (vaciala para ocultarla)'),
      },
      defaultProps: {},
      render: (p: any) => (
        <PlaceCard
          label={p.title || 'Videos'}
          note="Videos del demo. Editá los videos en la pantalla Videos."
          subtitle={p.description}
        />
      ),
    },
    ShopByLook: {
      label: 'Shop by look',
      fields: {
        slot: select('Ubicación', SHOP_BY_LOOK_SLOTS),
        title: text('Título de la sección (opcional)'),
        subtitle: textarea('Bajada (opcional)'),
      },
      defaultProps: { slot: 'top' },
      render: (p: any) => (
        <PlaceCard
          label={p.title || `Shop by look (${p.slot ?? 'top'})`}
          note="Looks comprables del demo. Editá los looks en la pantalla Shop by Look."
          subtitle={p.subtitle}
        />
      ),
    },

    // ── CampaignHero → hero de la landing institucional ──────────────────
    // Bloque exclusivo del template `campaign`. Renderiza el hero compacto
    // (imagen a la izquierda + copy a la derecha) con eyebrow, CTA y trust
    // badges optativos. El componente REAL vive en el
    // storefront (`modules/home-campaign/components/campaign-hero`); el
    // HomeRenderer del storefront tiene el `case 'CampaignHero'` que mapea
    // estas props al componente.
    CampaignHero: {
      label: 'Hero de campaña',
      fields: {
        eyebrow: text('Eyebrow (etiqueta arriba del título)'),
        title: text('Título'),
        subtitle: textarea('Subtítulo'),
        image: s3ImageField('Imagen del hero'),
        imageAlt: text('Alt de la imagen'),
        ctaText: text('CTA — texto (vacío = oculto)'),
        ctaHref: text('CTA — link (vacío = oculto)'),
        // CTA/eyebrow con override manual: sirven como escape para instituciones
        // que necesitan otro tratamiento sin cambiar el primario global. El
        // fondo del hero también puede editarse, pero conserva blanco por default.
        backgroundColor: text('Fondo del hero (hex, vacío = blanco)'),
        ctaBackgroundColor: text('CTA fondo (hex, vacío = color primario)'),
        ctaTextColor: text('CTA texto (hex, vacío = blanco)'),
        eyebrowBackgroundColor: text(
          'Eyebrow — fondo (hex, vacío = color secundario)',
        ),
        eyebrowTextColor: text('Eyebrow — texto (hex, vacío = blanco)'),
        trustBadges: {
          type: 'array' as const,
          label: 'Trust badges (bajo el CTA)',
          arrayFields: {
            id: text('ID (opcional; se autogenera si vacío)'),
            icon: select('Icono', CAMPAIGN_BADGE_ICON_OPTIONS),
            label: text('Texto'),
          },
          defaultItemProps: { id: '', icon: 'credit-card', label: '' },
          max: 6,
        },
      },
      defaultProps: {
        eyebrow: '',
        title: 'Llevá la tecnología del aula a tu casa',
        subtitle:
          'Kits de robótica, electrónica y programación creados junto a Educabot.',
        image: '',
        imageAlt: '',
        ctaText: 'Ver los kits',
        ctaHref: '#tienda',
        backgroundColor: '',
        ctaBackgroundColor: '',
        ctaTextColor: '',
        eyebrowBackgroundColor: '',
        eyebrowTextColor: '',
        trustBadges: [],
      },
      render: (p: any) => (
        <SectionCard
          label="Hero de campaña"
          props={p}
          note={`${(p.trustBadges ?? []).length} badge(s) · CTA: ${p.ctaText || '—'}`}
        />
      ),
    },
  },
};

// ─── Seed: layout por defecto por template ───────────────────────────────────
let _seq = 0;
const b = (type: string, props: Record<string, any> = {}) => ({
  type,
  // Null means inherit the store configuration. Omitted keys would let Puck
  // inject its "new block" example copy over the actual store's content.
  props: { ...Object.fromEntries(Object.keys(homeConfig.components[type]?.defaultProps ?? {}).map(key => [key, null])), id: `${type}-${++_seq}`, ...props },
});

const groceryLayout = {
  root: { props: {} },
  content: [
    b('Banners'),
    b('ShopByLook', { slot: 'top' }),
    b('Categorias'),
    b('ShopByLook', { slot: 'after_collections' }),
    b('BannerPromo'),
    b('Marcas'),
    b('ProductosDestacados', { preset: 'featuredProducts', cardVariant: 'default', viewAllHref: '/store' }),
    b('ShopByLook', { slot: 'after_featured' }),
    b('Combos'),
    b('ProductosDestacados', { preset: 'novedades', cardVariant: 'compact', viewAllHref: '/store' }),
    b('MasCategorias'),
    b('Videos'),
    b('ShopByLook', { slot: 'before_footer' }),
  ],
};

// Landing institucional (Campaña): hero de campaña + grid único de kits.
// El cuerpo de la home vive ACÁ (bloques Puck): el operador reordena, agrega
// o quita bloques del panel. Los slots SITE-LEVEL del template (announcement
// bar, chrome del header, footer institucional) NO viven en el Puck sino en
// `content_config.campaign` — se editan desde la pestaña Contenido del drawer
// del site.
const campaignLayout = {
  root: { props: {} },
  content: [
    b('CampaignHero', {
      eyebrow: '',
      title: 'Llevá la tecnología del aula a tu casa',
      subtitle:
        'Kits de robótica, electrónica y programación creados junto a Educabot.',
      image: '',
      imageAlt: '',
      ctaText: 'Ver los kits',
      ctaHref: '#tienda',
      trustBadges: [],
    }),
    b('ProductosDestacados', {
      preset: 'custom',
      title: 'Nuestros kits',
      description: 'Los kits disponibles este ciclo lectivo. Stock limitado.',
      source: 'newest',
      value: '',
      limit: 8,
      cardVariant: 'default',
      layout: 'grid-4',
      viewAllHref: '/store',
    }),
  ],
};

/** Seed por template_code. Grocery listo; verticales se agregan luego. */
export const DEFAULT_HOME_LAYOUT: Record<string, { root: any; content: any[] }> = {
  supermercado: groceryLayout,
  campaign: campaignLayout,
};

export function homeConfigForTemplate(template?: string, language = 'es'): Config {
  if (template && templateSections[template]) {
    const components = homeConfig.components;
    return { ...homeConfig, categories: { template: { title: language.startsWith('en') ? 'Template' : 'Plantilla', components: ['TemplateSection', 'Hero', 'RichText', 'ImageBlock', 'CTA', 'Spacer'] } }, components: {
      ...components,
      TemplateSection: {
        label: language.startsWith('en') ? 'Template section' : 'Sección de la plantilla',
        fields: { section: { type: 'select', label: language.startsWith('en') ? 'Section (content from store settings)' : 'Sección (contenido desde la configuración de la tienda)', options: templateSections[template].map((label, index) => ({ label, value: String(index + 1) })) } },
        defaultProps: { section: '1' }, render: () => <></>,
      },
    } } as Config;
  }
  return homeConfig;
}

export default homeConfig;
const templateSections: Record<string, string[]> = {
  "technology": [
    "Hero",
    "Categorías",
    "Marcas",
    "Productos",
    "Promociones",
    "Usos",
    "Banner",
    "Beneficios",
    "Newsletter"
  ],
  "fashion": [
    "Hero",
    "Looks: inicio",
    "Colecciones",
    "Looks: colecciones",
    "Campaña",
    "Novedades",
    "Looks: productos",
    "Categorías",
    "Lookbook",
    "Destacados",
    "Temporada",
    "Looks: cierre",
    "Newsletter"
  ],
  "tech-retail": [
    "Hero",
    "Categorías",
    "Marcas",
    "Financiación",
    "Productos",
    "Gaming",
    "Home office",
    "Beneficios",
    "Newsletter"
  ],
  "sports": [
    "Hero",
    "Looks: inicio",
    "Marcas",
    "Deportes",
    "Calzado",
    "Looks: productos",
    "Colecciones",
    "Looks: colecciones",
    "Indumentaria",
    "Categorías",
    "Campaña",
    "Remeras",
    "Lookbook",
    "Looks: cierre"
  ]
};
for (const [template, sections] of Object.entries(templateSections)) {
  DEFAULT_HOME_LAYOUT[template] = { root: { props: {} }, content: sections.map((label, index) => b('TemplateSection', { section: String(index + 1) })) };
}

/** Preserve saved Puck content; only seed from store settings when no document exists. */
export function defaultHomeForStore(store: { template_code: string; is_main?: boolean | null; content_config?: any }) {
  const seed = DEFAULT_HOME_LAYOUT[store.template_code];
  if (seed && store.is_main && store.template_code === 'supermercado') {
    const content = seed.content.filter(block => block.type !== 'MasCategorias' && block.type !== 'Videos' && !(block.type === 'ShopByLook' && block.props.slot === 'before_footer'));
    return { ...seed, content: [...content, b('Blog'), b('Videos'), b('ProductosDestacados', { preset: 'renovaEnergia', cardVariant: 'compact', onlyPromotions: true, maxItems: 4, viewAllLabel: 'Ver todas las promociones', viewAllHref: '/store?promos=1' }), b('MasCategorias'), b('ProductosDestacados', { preset: 'destacadosDelMes' }), b('ShopByLook', { slot: 'before_footer' })] };
  }
  if (!seed || store.template_code !== 'campaign') return seed;
  const hero = store.content_config?.campaign?.hero;
  if (!hero) return seed;
  return { ...seed, content: seed.content.map(block => block.type !== 'CampaignHero' ? block : {
    ...block, props: { ...block.props, ...hero, ...(hero.primaryCta ? { ctaText: hero.primaryCta.text, ctaHref: hero.primaryCta.href } : {}) },
  }) };
}
