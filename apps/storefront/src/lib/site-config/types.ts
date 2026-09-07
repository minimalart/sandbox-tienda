/**
 * Tipos TypeScript para configuración de tenants
 */

export type TenantMedusaConfig = {
  /** ID del sales channel (hardcodeado, no variable de entorno) */
  salesChannelId: string
  /** ID del customer group para precios especiales (hardcodeado) */
  customerGroupId?: string
  /** Publishable key opcional (puede ser compartida o específica) */
  publishableKey?: string
  /**
   * Config del portal mayorista (B2B), presente solo cuando el demo tiene B2B
   * habilitado. `salesChannelId` es el canal mayorista dedicado del demo; `tiers`
   * son las escalas por cantidad que el order builder muestra/aplica.
   */
  b2b?: {
    enabled: boolean
    salesChannelId: string
    tiers?: { minQty: number; discount: number }[]
  }
  /**
   * Compras recurrentes (suscripciones de reposición), presente solo cuando el
   * demo habilita el toggle. Muestra "Suscribirse" en la PDP, "Convertir en
   * compra recurrente" en el carrito y la sección de cuenta.
   */
  recurring?: {
    enabled: boolean
  }
  /**
   * Tintometría, presente solo cuando la fila del sitio habilita el toggle — y eso
   * incluye a la fila de la tienda PRINCIPAL, que antes se salteaba (ver
   * `lib/data/tinting-gate.ts`). Gatea la página "Buscá tu color" (color → bases) y
   * su link en el menú. La data maestra es de la instancia: las rutas
   * /store/tinting/* siguen exigiendo el switch del ERP, así que esto sólo decide
   * si se muestra la vidriera.
   */
  tinting?: {
    enabled: boolean
  }
  /**
   * Página de contraseña (site gate), presente solo cuando el demo la tiene
   * activa. `length` es el largo de la palabra: cuántas casillas dibuja el
   * formulario. La palabra NO viaja — el config del demo es público y la
   * verificación vive en el backend (ver lib/site-config/site-gate.ts).
   */
  passwordGate?: {
    enabled: boolean
    length: number
  }
}

export type TenantTheme = {
  colors: {
    primary: string
    secondary?: string
    accent?: string
    /**
     * Fondo del header/footer. Ausentes = cada template usa su fondo propio
     * (blanco en grocery, --f-canvas en moda, etc). Se inyectan como las CSS
     * vars `--header-bg` / `--footer-bg` (ver theme/inject-theme.ts) y el
     * chrome las consume con fallback a su default.
     */
    headerBackground?: string
    footerBackground?: string
  }
  typography?: {
    fontFamily?: string
  }
}

export type HeroBanner = {
  id: string
  title: string
  subtitle: string
  image: string
  cardColor?: string
  cta: {
    text: string
    href: string
  }
}

export type HeroSideCard = {
  id: string
  title: string
  subtitle: string
  mobileTitle?: string
  mobileSubtitle?: string
  image?: string
  gradient?: string
  badgeBg?: string
  productImage?: string
  href: string
  colorFont?: string
}

export type FeaturedCategory = {
  id: string
  title: string
  image?: string
  badge?: string
  badgeVariant?: 'dark' | 'light'
  href: string
  isAction?: boolean
}

export type NewArrivalProduct = {
  productId: string
  image?: string
  label?: string
  backgroundColor?: string
}

export type CollectionProduct = {
  collectionId: string
  handle?: string
  searchQuery?: string
  href?: string
  image?: string
  label?: string
  backgroundColor?: string
  /** Imagen de fondo de la card. Si está seteada, pisa `backgroundColor`. */
  backgroundImage?: string
}

export type CleaningProduct = {
  productId: string
  image: string
  label: string
  price: string
}

export type MoreProductsItem = {
  categoryId: string
  productId?: string
  image: string
  label: string
  backgroundColor?: string
  href: string
}

export type NewArrivalsConfig = {
  title?: string
  subtitle?: string
  products: NewArrivalProduct[]
  viewAllCard?: {
    title: string
    subtitle?: string
    href: string
  }
  backgrounds?: string[]
}

export type CollectionConfig = {
  title?: string
  mobileTitle?: string
  subtitle?: string
  collections: CollectionProduct[]
  viewAllCard?: {
    title: string
    subtitle?: string
    href: string
  }
  backgrounds?: string[]
}

export type MoreProductsConfig = {
  title?: string
  subtitle?: string
  items: MoreProductsItem[]
  viewAllCard?: {
    title: string
    subtitle?: string
    href: string
  }
}

export type FeaturedProductsSortBy = 'created_at' | 'price_asc' | 'price_desc'

export type FeaturedProductsConfig = {
  title?: string
  mobileTitle?: string
  description?: string
  filter?: {
    categoryId?: string
    collectionId?: string
    limit?: number
    sortBy?: FeaturedProductsSortBy
    productIds?: string[]
    searchQuery?: string
    tag?: string
  }
}

export type CleaningSolutionsConfig = {
  title?: string
  mobileTitle?: string
  description?: string
  tagId: string
  limit?: number
}

export type ShoppableVideoItem = {
  /** Identificador opcional; si falta se deriva del vimeoId */
  id?: string
  /** ID numérico del video en Vimeo (el de la URL player.vimeo.com/video/{id}) */
  vimeoId: string
  /** Imagen de portada mientras el video carga. Cae al thumbnail del producto si falta */
  poster?: string
  /** Producto a vincular. Si falta o no resuelve, se rellena con un producto del catálogo */
  productId?: string
}

export type ShoppableVideosConfig = {
  title?: string
  mobileTitle?: string
  description?: string
  /**
   * Clips demo para la sección Vimeo + tarjeta de producto.
   * Solo se usan como fallback: si el backend de Medusa expone videos
   * activos en /store/videos, esos tienen prioridad.
   */
  videos?: ShoppableVideoItem[]
}

/**
 * Sección de notas del blog en el home. Solo textos: los artículos son los
 * reales del blog del canal activo, no se configuran acá.
 */
export type BlogHighlightsConfig = {
  title?: string
  /** Cadena vacía = sin subtítulo; ausente = copy por defecto. */
  subtitle?: string
  /**
   * La cantidad NO se configura: la sección siempre muestra las 2 últimas notas
   * (destacada + secundaria), que es su layout.
   */
  /** Limita la sección a una categoría del blog (id). Ausente = todas. */
  categoryId?: string
  /** Botón del artículo destacado. Default "Leer nota". */
  featuredCtaLabel?: string
  /** Botón de los artículos secundarios. Default "Leer nota". */
  ctaLabel?: string
  /** Link a `/blog`. Cadena vacía = no se muestra. */
  viewAllLabel?: string
}

export type PartnerLogo = {
  name: string
  /** Marca usada para el filtro /store?brand=... (default: name) */
  brand?: string
  /** URL o ruta del logo */
  src: string
  /** Clases extra para el <img> del logo */
  logoClass?: string
  /** Clases extra para el hover del logo */
  hoverClass?: string
}

export type KitContentItem = {
  name: string
  quantity: number
  image?: string
}

export type ResellerKit = {
  productId: string
  title: string
  subtitle: string
  image: string
  popular?: boolean
  bgColor: string
  video?: string
  poster?: string
  href?: string
  contents?: KitContentItem[]
}

export type ResellerKitsConfig = {
  title?: string
  subtitle?: string
  titleHome?: string
  descriptionHome?: string
  kits: ResellerKit[]
}

export type SocialLink = {
  name: string
  href: string
  icon?:
    | 'facebook'
    | 'instagram'
    | 'twitter'
    | 'linkedin'
    | 'youtube'
    | 'tiktok'
}

export type ContactInfo = {
  phone?: {
    label?: string
    value: string
    href?: string
  }
  email?: {
    label?: string
    value: string
    href?: string
  }
  /**
   * Horario de atención. Va acá y no en `FooterConfig` porque ES dato de contacto:
   * la columna "Atención al cliente" del footer lo muestra al lado del teléfono y
   * del mail, que salen de las dos claves de arriba.
   */
  hours?: {
    label?: string
    value: string
  }
  location?: {
    label?: string
    value: string
  }
}

export type ContactPage = {
  /**
   * Copy de la tarjeta "Atención al cliente" de `/contact`, editable desde el
   * backoffice (`content_config.contactPage`). Ausente = los defaults de la
   * página, que son los de siempre: una tienda que no configuró nada se ve igual.
   */
  title?: string
  /**
   * El párrafo bajo el título. Hay TRES `description` en juego y no son la misma:
   * `TenantConfig.metadata.description` (SEO + social card),
   * `assets.footer.description` (el párrafo bajo el logo del footer) y esta.
   */
  description?: string
  /** El cartel gris al pie de la tarjeta. */
  note?: string
  phone?: {
    label: string
    value: string
  }
  whatsApp?: {
    label: string
    value: string
  }
  email?: {
    label: string
    value: string
  }
  location?: {
    label?: string
    value: string
  }
  contactFaq?: FaqItem[]
}

export type FaqItem = {
  question: string
  answer: string
}

export type NewsletterConfig = {
  title?: string
  placeholder?: string
  buttonText?: string
  description?: string
  endpoint?: string // Opcional: endpoint para suscripción
}

export type FooterConfig = {
  description?: string
  newsletter?: NewsletterConfig
  contact?: ContactInfo
  social?: SocialLink[]
  legal?: { name: string; href: string }[]
  /**
   * Línea de copyright. `{year}` se reemplaza por el año en curso al renderizar,
   * así que el texto guardado no envejece: sin eso, el footer de una tienda que
   * nadie tocó en enero seguiría diciendo el año pasado.
   */
  copyright?: string
}

export type TopbarIconType =
  | 'credit-card'
  | 'truck'
  | 'gift'
  | 'shield'
  | 'star'
  | 'tag'
  | 'sparkles'
  | 'fire'
  | 'bolt'
  | 'clock'
  | 'phone'
  | 'map-pin'
  | 'heart'
  | 'check-badge'
  | 'banknotes'
  | 'shopping-bag'
  | 'shopping-cart'
  | 'receipt-percent'
  | 'ticket'
  | 'megaphone'
  | 'bell'
  | 'globe'
  | 'rocket'
  | 'building-storefront'

export type TopbarMessage = {
  id: string
  text: string
  icon: TopbarIconType
}

export type TopbarConfig = {
  messages: TopbarMessage[]
  rotationInterval?: number // en milisegundos, default 6000
  enabled?: boolean // default true
}

/**
 * Banner promocional del home (`PromoBanner`): fondo de color, textos + botón a
 * un lado e imagen al otro. Sin `title` la sección no se renderiza.
 */
export type PromoBannerConfig = {
  title?: string
  subtitle?: string
  /** Imagen del lado libre de la tarjeta. Ausente = tarjeta solo con texto. */
  image?: string
  /** Fondo de la tarjeta (hex). Ausente = verde suave neutro. */
  backgroundColor?: string
  /** Color de título y bajada (hex). Ausente = grises del home. */
  textColor?: string
  /** Color del botón (hex). Ausente = color de marca del tenant. */
  accentColor?: string
  /** Lado de la imagen en desktop. Ausente = 'right'. */
  imagePosition?: 'left' | 'right'
  cta?: { text: string; href: string }
}

export type TenantAssets = {
  logos: {
    main: string
    footer?: string
    mobile?: string
    /**
     * Variantes negativo, para fondos OSCUROS. Hoy se exponen sin consumo: la
     * barra inferior mobile tiene el círculo `bg-white` y usa siempre el
     * isotipo positivo (ver `bottom-nav/nav-icon.ts`).
     */
    mainNegative?: string
    iconNegative?: string
  }
  /**
   * MercadoPago config for this tenant: which checkout(s) to show and the
   * public key the embedded Payment Brick needs. Set by the backend's
   * buildTenantConfig from the demo's content_config + MERCADOPAGO_ACCOUNTS.
   */
  mercadopago?: {
    checkoutMode?: 'api' | 'express' | 'both'
    publicKey?: string | null
  }
  banners?: {
    hero?: string[]
  }
  heroBanners?: {
    carousel?: HeroBanner[]
    sideCards?: HeroSideCard[]
  }
  featuredCategories?: {
    title?: string
    categories: FeaturedCategory[]
  }
  newArrivals?: NewArrivalsConfig
  collections?: CollectionConfig
  renewEnergy?: CollectionConfig
  featuredProducts?: FeaturedProductsConfig
  cleaningSolutions?: CleaningSolutionsConfig
  merchandising?: FeaturedProductsConfig
  novedades?: FeaturedProductsConfig
  destacadosDelMes?: FeaturedProductsConfig
  renovaEnergia?: FeaturedProductsConfig
  moreProducts?: MoreProductsConfig
  /** Textos de la sección de notas del blog del home. Ausente = defaults. */
  blogHighlights?: BlogHighlightsConfig
  /** Banner promocional del home. Ausente = la sección no se renderiza. */
  promoBanner?: PromoBannerConfig
  shoppableVideos?: ShoppableVideosConfig
  resellerKits?: ResellerKitsConfig
  /** Logos de marcas/partners para la sección LogoShowcase */
  partners?: PartnerLogo[]
  footer?: FooterConfig
  topbar?: TopbarConfig
  favicon?: string
  /** Favicon negativo (dark mode). Se expone; consumo pendiente. */
  faviconNegative?: string
  contactPage?: ContactPage
  /**
   * Visibilidad de secciones del storefront (links del nav + entradas de la
   * home). Ausente o `true` = visible. Se configura por demo; en el store
   * principal queda ausente (todo visible).
   */
  sectionVisibility?: {
    blog?: boolean
    contact?: boolean
    shoppingList?: boolean
    sucursales?: boolean
    /** Link "Cuentas corporativas" (/corporate/register) del footer. */
    corporate?: boolean
    /**
     * Menú "Categorías" del nav de escritorio (antes de "Tienda"). Ausente/true
     * = visible; igual no se pinta si la tienda no tiene categorías.
     */
    categories?: boolean
    /**
     * Etiquetas de variantes en las cards del catálogo: el formato/medida abajo
     * a la izquierda y los colores (círculo SVG) arriba a la izquierda.
     * Ausente/true = visibles; igual no se pintan si el producto no tiene
     * options con valores reales (`Formato: Único` no cuenta).
     */
    variantLabels?: boolean
    /**
     * Página "Buscá tu color" (flujo color → bases del tintométrico). A
     * diferencia del resto de esta lista, es OPT-IN: sólo se muestra si el
     * tenant tiene tintometría habilitada. Este flag alcanza para esconderla en
     * un tenant que sí la tiene, no para prenderla en uno que no.
     */
    tinting?: boolean
  }
  /**
   * Variante visual del menú "Categorías" del nav. Se configura por demo
   * (Contenido → "Diseño del menú de categorías"); ausente = 'hamburger'.
   *  - 'hamburger': link con ícono de hamburguesa + panel con submenú lateral
   *  - 'button': pill sólido en el color de marca + acordeón de subcategorías
   */
  categoriesMenuLayout?: 'hamburger' | 'button'
  /**
   * Override del nombre de la sección de blog: reemplaza el label del nav
   * ("Recetas") y el título de la página `/blog`. Ausente = default del blog.
   */
  blogSectionName?: string
  /**
   * Página de sucursales (`/sucursales`). Ausente = defaults hardcodeados.
   * La visibilidad del link vive en `sectionVisibility.sucursales`.
   */
  sucursales?: {
    /** Subtítulo. Ausente = copy por defecto; cadena vacía = no se muestra. */
    subtitle?: string
    /** Filtro de ubicación (regiones). Ausente/true = visible. */
    showLocationFilters?: boolean
    /** Filtro de categoría (tipo de sucursal). Ausente/true = visible. */
    showCategoryFilters?: boolean
    /**
     * `full` (default) = buscador + filtros + mapa + listado abajo.
     * `compact` = pocas sucursales: listado al lado del mapa, sin buscador
     * ni filtros.
     */
    layout?: 'full' | 'compact'
  }
  /** Textos editables de la página de lista de compras. Ausente = default. */
  shoppingList?: {
    title?: string
    subtitle?: string
    /** Chips "Agregá rápido" (modal + página). Ausente = default hardcodeado. */
    quickTerms?: string[]
  }
  /**
   * Accesos rápidos del buscador del header ("Explorar:"). Solo se usan en el
   * template grocery/supermercado; ausente = default hardcodeado.
   */
  searchSuggestions?: { label: string; query: string }[]
  /**
   * Textos rotativos (placeholder) del buscador del header, header flotante y
   * buscador mobile. Ausente = default hardcodeado.
   */
  searchHints?: string[]
  /**
   * Diseño de la sección "Nuestras marcas" del home. Se configura por demo
   * (Contenido → "Diseño de la sección de marcas"); ausente = 'carousel'.
   *  - 'carousel': fila con flechas, tarjetas que se levantan al hover
   *  - 'marquee': marquesina infinita, grises que toman color al hover
   *  - 'dots': páginas limpias con indicadores de puntos
   */
  brandsLayout?: 'carousel' | 'marquee' | 'dots'
  /**
   * Contenido de la home del template Tecnología. Solo se usa cuando
   * `TenantConfig.template === 'technology'`. El template Grocery lo ignora.
   */
  technology?: TechnologyHomeConfig
  /**
   * Contenido de la home del template Moda. Solo se usa cuando
   * `TenantConfig.template === 'fashion'`. Los demás templates lo ignoran.
   */
  fashion?: FashionHomeConfig
  /**
   * Contenido de la home del template Tecnología Retail (Frávega / Best Buy).
   * Solo se usa cuando `TenantConfig.template === 'tech-retail'`.
   */
  techRetail?: TechRetailHomeConfig
  /**
   * Contenido de la home del template Marca Deportiva (Adidas / Puma / Nike).
   * Solo se usa cuando `TenantConfig.template === 'sports'`.
   */
  sports?: SportsHomeConfig
  /**
   * Contenido de la home del template Landing institucional (Campaña). Solo
   * se usa cuando `TenantConfig.template === 'campaign'`. Los demás templates
   * lo ignoran. Diseño minimalista: hero + grid de kits + footer con datos de
   * la institución.
   */
  campaign?: CampaignHomeConfig
  /**
   * Home personalizada de la tienda (documento Puck { content, root }) editada
   * desde "Personalizar home" en el admin. Cuando está presente y tiene
   * contenido, el home se renderiza con HomeRenderer —montando las secciones
   * REALES con el contenido editado, en cualquier template— tanto en el sitio
   * principal (`/`) como en un demo (`/demo/{slug}`). Ausente = home
   * hardcodeada por defecto.
   */
  homeLayout?: {
    content?: HomeLayoutBlock[]
    root?: Record<string, unknown>
  }
}

/** Un bloque del documento Puck del home: tipo de bloque + props (contenido). */
export type HomeLayoutBlock = {
  type: string
  props?: Record<string, any>
}

export type TenantMetadata = {
  name: string
  description?: string
  contact?: {
    email?: string
    phone?: string
  }
  seo?: {
    title?: string
    description?: string
    keywords?: string[]
  }
}

/**
 * Plantilla visual/estructural de la home.
 *
 * - `grocery`: template original de supermercado (default).
 * - `technology`: template de Tecnología / Electrodomésticos.
 * - `fashion`: template de Moda / Indumentaria.
 *
 * - `tech-retail`: template de Tecnología Retail de alta densidad (Frávega /
 *   Best Buy / Cetrogar). Distinto del minimalista `technology`.
 * - `sports`: template de Marca Deportiva (Adidas / Puma / Nike).
 *
 * Cada demo selecciona su template; conviven sin reemplazarse.
 */
export type TenantTemplate =
  | 'grocery'
  | 'technology'
  | 'fashion'
  | 'tech-retail'
  | 'sports'
  | 'campaign'

// ───────────────────────── Technology template ─────────────────────────
// Tipos de contenido dinámico para la home del template "technology".
// Cada sección consume su bloque de config para poder variar por demo /
// vertical / sales channel sin tocar el código de los componentes.

export type TechBenefitIcon =
  | 'truck'
  | 'store'
  | 'shield'
  | 'lock'
  | 'headset'
  | 'credit-card'
  | 'refresh'
  | 'badge-check'

export type TechPromoIcon =
  | 'credit-card'
  | 'bank'
  | 'truck'
  | 'clock'
  | 'tag'
  | 'percent'
  | 'gift'

/** Ítem del menú de categorías del header tecnológico. */
export type TechHeaderCategory = {
  id: string
  name: string
  href: string
}

export type TechHeaderConfig = {
  /** Placeholder del buscador protagonista. */
  searchPlaceholder?: string
  /** Menú de categorías principal. */
  categories?: TechHeaderCategory[]
}

export type TechHeroConfig = {
  /** Línea superior pequeña (marca / línea de producto). */
  eyebrow?: string
  title: string
  subtitle?: string
  /** Bajada comercial destacada (ej: "Hasta 12 cuotas sin interés"). */
  highlight?: string
  /** Precio o promo destacada, si aplica. */
  price?: string
  image: string
  /** Tono del hero: claro (default) u oscuro tipo Apple. */
  theme?: 'light' | 'dark'
  primaryCta?: { text: string; href: string }
  secondaryCta?: { text: string; href: string }
}

export type TechCategory = {
  id: string
  name: string
  image?: string
  href: string
  /** Fondo de la card cuando no hay imagen full-bleed. */
  backgroundColor?: string
}

export type TechFeaturedCategoriesConfig = {
  title?: string
  subtitle?: string
  categories: TechCategory[]
}

export type TechBrand = {
  id: string
  name: string
  /** Logo opcional; si falta se muestra el nombre. */
  logo?: string
  href: string
}

export type TechFeaturedBrandsConfig = {
  title?: string
  subtitle?: string
  brands: TechBrand[]
}

export type TechPromotionBlock = {
  id: string
  icon?: TechPromoIcon
  title: string
  description?: string
  href?: string
  /** Color de acento (texto/borde) del bloque. */
  accent?: string
  /** Fondo del bloque. */
  backgroundColor?: string
}

export type TechPromotionsConfig = {
  title?: string
  subtitle?: string
  blocks: TechPromotionBlock[]
}

export type TechUseCase = {
  id: string
  title: string
  subtitle?: string
  image?: string
  href: string
  theme?: 'light' | 'dark'
}

export type TechUseCasesConfig = {
  title?: string
  subtitle?: string
  items: TechUseCase[]
}

export type TechSecondaryBannerConfig = {
  eyebrow?: string
  title: string
  subtitle?: string
  image: string
  theme?: 'light' | 'dark'
  cta?: { text: string; href: string }
}

export type TechBenefit = {
  id: string
  icon: TechBenefitIcon
  title: string
  description?: string
}

export type TechBenefitsConfig = {
  title?: string
  subtitle?: string
  items: TechBenefit[]
}

export type TechNewsletterConfig = {
  title?: string
  description?: string
  placeholder?: string
  buttonText?: string
}

/**
 * Configuración completa de la home del template Tecnología.
 * Todas las secciones son opcionales: si falta el bloque, la sección no
 * se renderiza. Pensado para alimentarse por demo / vertical / canal.
 */
export type TechnologyHomeConfig = {
  header?: TechHeaderConfig
  hero?: TechHeroConfig
  featuredCategories?: TechFeaturedCategoriesConfig
  featuredBrands?: TechFeaturedBrandsConfig
  /** Reusa el filtro Typesense estándar para los productos destacados. */
  featuredProducts?: FeaturedProductsConfig
  promotions?: TechPromotionsConfig
  useCases?: TechUseCasesConfig
  secondaryBanner?: TechSecondaryBannerConfig
  benefits?: TechBenefitsConfig
  newsletter?: TechNewsletterConfig
  footer?: FooterConfig
}

// ─────────────────────────── Fashion template ───────────────────────────
// Tipos de contenido dinámico para la home del template "fashion".
// Editorial, premium y con la fotografía como protagonista: cada sección
// consume su bloque de config para variar por demo / vertical / canal sin
// tocar el código de los componentes. La prioridad es construir deseo, no
// vender descuentos — por eso no hay tipos para badges ni precios tachados.

/** Ítem de navegación principal del header de moda. */
export type FashionNavItem = {
  id: string
  name: string
  href: string
}

export type FashionHeaderConfig = {
  /** Placeholder del buscador (discreto). */
  searchPlaceholder?: string
  /** Navegación principal (Mujer, Hombre, Calzado, …). */
  nav?: FashionNavItem[]
}

/** Hero editorial full-width: fotografía de campaña + CTA discreto. */
export type FashionHeroConfig = {
  eyebrow?: string
  title: string
  subtitle?: string
  image: string
  /** Imagen alternativa para mobile (recorte vertical), si aplica. */
  imageMobile?: string
  /** Tono del texto sobre la imagen. */
  theme?: 'light' | 'dark'
  /** Posición del bloque de texto sobre la imagen. */
  align?: 'left' | 'center' | 'right'
  /** Posición vertical del bloque de texto. */
  verticalAlign?: 'top' | 'center' | 'bottom'
  cta?: { text: string; href: string }
}

/** Card de colección destacada (Mujer, Hombre, Calzado, Nueva Colección…). */
export type FashionCollection = {
  id: string
  name: string
  image: string
  href: string
  /** Texto superpuesto opcional (ej: "Nueva Colección"). */
  label?: string
  /** Permite que una card ocupe más espacio en el grid. */
  span?: 'normal' | 'wide' | 'tall'
  theme?: 'light' | 'dark'
}

export type FashionCollectionsConfig = {
  title?: string
  subtitle?: string
  collections: FashionCollection[]
}

/** Bloque de campaña / storytelling editorial. */
export type FashionCampaignConfig = {
  eyebrow?: string
  title: string
  body?: string
  image: string
  theme?: 'light' | 'dark'
  /** Lado donde se ubica la imagen respecto al texto (desktop). */
  imageSide?: 'left' | 'right'
  cta?: { text: string; href: string }
}

/** Categoría lifestyle (Workwear, Casual, Outdoor, Running, Essentials). */
export type FashionLifestyleCategory = {
  id: string
  name: string
  image?: string
  href: string
}

export type FashionLifestyleConfig = {
  title?: string
  subtitle?: string
  items: FashionLifestyleCategory[]
}

/** Foto editorial del lookbook; puede enlazar colección / categoría / producto. */
export type FashionLookbookItem = {
  id: string
  image: string
  label?: string
  href: string
  span?: 'normal' | 'wide' | 'tall'
}

export type FashionLookbookConfig = {
  title?: string
  subtitle?: string
  items: FashionLookbookItem[]
}

/** Banner de temporada: bloque visual grande con fotografía protagonista. */
export type FashionSeasonBannerConfig = {
  eyebrow?: string
  title: string
  subtitle?: string
  image: string
  theme?: 'light' | 'dark'
  align?: 'left' | 'center' | 'right'
  cta?: { text: string; href: string }
}

export type FashionNewsletterConfig = {
  title?: string
  description?: string
  placeholder?: string
  buttonText?: string
}

/**
 * Configuración completa de la home del template Moda.
 * Todas las secciones son opcionales: si falta el bloque, la sección no se
 * renderiza. Pensado para alimentarse por demo / vertical / canal.
 */
export type FashionHomeConfig = {
  header?: FashionHeaderConfig
  hero?: FashionHeroConfig
  featuredCollections?: FashionCollectionsConfig
  campaign?: FashionCampaignConfig
  /** New Arrivals (carrusel de productos) — reusa el filtro Typesense. */
  newArrivals?: FeaturedProductsConfig
  lifestyleCategories?: FashionLifestyleConfig
  lookbook?: FashionLookbookConfig
  /** Productos destacados (carrusel secundario) — reusa el filtro Typesense. */
  featuredProducts?: FeaturedProductsConfig
  seasonBanner?: FashionSeasonBannerConfig
  newsletter?: FashionNewsletterConfig
  footer?: FooterConfig
}

// ─────────────────────── Technology Retail template ───────────────────────
// Tipos para la home del template "tech-retail": retailer de electrónica y
// electrodomésticos de alta densidad (Frávega / Best Buy / Cetrogar). A
// diferencia de `technology` (Apple/Samsung, minimalista), el foco está en gran
// catálogo, marcas, financiación/cuotas, promociones y cards informativas.
// Reutiliza varios tipos del template Tecnología (TechHeaderCategory,
// TechCategory, TechBrand, TechBenefit, etc.).

/** Slide del hero promocional (carrusel de campañas). */
export type TrHeroSlide = {
  id: string
  eyebrow?: string
  title: string
  subtitle?: string
  /** Bajada comercial destacada (ej: "Hasta 18 cuotas sin interés"). */
  highlight?: string
  image: string
  /** Tono del texto sobre el slide. */
  theme?: 'light' | 'dark'
  /** Color de fondo del slide (cuando la imagen no es full-bleed). */
  backgroundColor?: string
  primaryCta?: { text: string; href: string }
  secondaryCta?: { text: string; href: string }
}

export type TrHeroConfig = {
  slides: TrHeroSlide[]
  /** ms entre slides (default 6000). */
  rotationInterval?: number
}

/** Plan / beneficio de financiación (cuotas, bancos, promociones). */
export type TrFinancingPlan = {
  id: string
  icon?: TechPromoIcon
  /** Texto grande destacado (ej: "18", "12"). */
  highlight?: string
  title: string
  description?: string
  href?: string
  accent?: string
  backgroundColor?: string
}

export type TrFinancingConfig = {
  title?: string
  subtitle?: string
  plans: TrFinancingPlan[]
}

/**
 * Configuración completa de la home del template Tecnología Retail.
 * Todas las secciones son opcionales: si falta el bloque, la sección no se
 * renderiza. Pensado para alimentarse por demo / vertical / canal.
 */
export type TechRetailHomeConfig = {
  header?: TechHeaderConfig
  hero?: TrHeroConfig
  categories?: TechFeaturedCategoriesConfig
  brands?: TechFeaturedBrandsConfig
  /** Reusa el filtro Typesense estándar para los productos destacados. */
  featuredProducts?: FeaturedProductsConfig
  financing?: TrFinancingConfig
  /** Banner Gaming (opcional). Reusa el shape del banner secundario tech. */
  gaming?: TechSecondaryBannerConfig
  /** Banner Home Office (opcional). */
  homeOffice?: TechSecondaryBannerConfig
  benefits?: TechBenefitsConfig
  newsletter?: TechNewsletterConfig
  footer?: FooterConfig
}

// ──────────────────────────── Sports template ────────────────────────────
// Tipos para la home del template "sports": marca deportiva (Adidas / Puma /
// Nike). Performance, movimiento y deporte — bold, alto contraste, tipografía
// condensada en mayúsculas y fotografía full-bleed. Reutiliza shapes del
// template Moda (FashionHeroConfig, FashionCampaignConfig, FashionLookbookConfig,
// FashionNewsletterConfig, FashionNavItem) donde la estructura coincide.

/** Una columna del megamenú: título + enlaces. */
export type SportsMegaMenuColumn = {
  title: string
  links: { name: string; href: string }[]
}

/** Imagen destacada (promo) que acompaña al megamenú a la derecha. */
export type SportsMegaMenuFeatured = {
  image: string
  title?: string
  subtitle?: string
  href: string
}

/** Megamenú desplegable de un ítem de navegación (Hombre/Mujer/Niños…). */
export type SportsMegaMenu = {
  columns: SportsMegaMenuColumn[]
  featured?: SportsMegaMenuFeatured
}

/** Ítem de navegación del header deportivo; puede abrir un megamenú. */
export type SportsNavItem = {
  id: string
  name: string
  href: string
  megamenu?: SportsMegaMenu
}

export type SportsHeaderConfig = {
  searchPlaceholder?: string
  /** Navegación principal (Hombre, Mujer, Niños, Deportes…). */
  nav?: SportsNavItem[]
}

/** Tarjeta de deporte del bloque principal (Running, Football, Training…). */
export type SportCategory = {
  id: string
  name: string
  image?: string
  href: string
}

export type SportCategoryGridConfig = {
  title?: string
  subtitle?: string
  sports: SportCategory[]
}

/** Colección destacada (Running Essentials, Train Hard, Match Day). */
export type SportsCollection = {
  id: string
  name: string
  subtitle?: string
  image: string
  href: string
  theme?: 'light' | 'dark'
}

export type SportsCollectionsConfig = {
  title?: string
  subtitle?: string
  collections: SportsCollection[]
}

/** Categoría de producto (Calzado, Indumentaria, Accesorios). */
export type SportsCategoryTile = {
  id: string
  name: string
  image?: string
  href: string
}

export type SportsCategoriesConfig = {
  title?: string
  subtitle?: string
  items: SportsCategoryTile[]
}

/** Atleta / embajador (bloque opcional). */
export type SportsAthlete = {
  id: string
  name: string
  sport?: string
  quote?: string
  image: string
  href: string
}

export type SportsAthletesConfig = {
  title?: string
  subtitle?: string
  athletes: SportsAthlete[]
}

/**
 * Configuración completa de la home del template Marca Deportiva.
 * Todas las secciones son opcionales: si falta el bloque, la sección no se
 * renderiza. Pensado para alimentarse por demo / vertical / canal.
 */
export type SportsHomeConfig = {
  header?: SportsHeaderConfig
  hero?: FashionHeroConfig
  /** Slides del hero (carrusel animado). Si hay más de uno, el hero rota. */
  heroSlides?: FashionHeroConfig[]
  /** Bloque principal: deportes. */
  sports?: SportCategoryGridConfig
  collections?: SportsCollectionsConfig
  categories?: SportsCategoriesConfig
  campaign?: FashionCampaignConfig
  /** Productos destacados (cards minimalistas) — reusa el filtro Typesense. */
  featuredProducts?: FeaturedProductsConfig
  athletes?: SportsAthletesConfig
  lookbook?: FashionLookbookConfig
  newsletter?: FashionNewsletterConfig
  footer?: FooterConfig
}

// ─────────────────────── Campaign (landing institucional) ───────────────────────
// Template minimalista para tiendas institucionales/educativas: hero + grid
// único de kits/productos + footer con datos de contacto físicos. No monta
// rails de banners/blog/videos/brands — el catálogo es acotado y el foco está
// en un lineup fijo por ciclo.

export type CampaignBadgeIcon =
  | 'credit-card'
  | 'store'
  | 'shield'
  | 'truck'
  | 'clock'
  | 'sparkles'
  | 'gift'
  | 'graduation-cap'

/** Un trust badge del hero (ícono + texto corto). */
export type CampaignTrustBadge = {
  id: string
  icon: CampaignBadgeIcon
  label: string
}

/** Anuncio superior del sitio (barra fina arriba del header). */
export type CampaignAnnouncementConfig = {
  /** Texto plano. Ausente/vacío = no se renderiza la barra. */
  text?: string
  /** Link opcional para envolver el texto entero. */
  href?: string
}

/** Chrome custom del template. */
export type CampaignChromeConfig = {
  /** Subtítulo debajo del logo, en el header. Ej: "TIENDA OFICIAL". */
  subtitle?: string
  /** Copy del pill "Powered by" del header. Vacío = se oculta. */
  poweredByLabel?: string
  /** Link del pill "Powered by". */
  poweredByHref?: string
}

/** Hero principal (protagonista de la landing). */
export type CampaignHeroConfig = {
  /** Etiqueta chica arriba del título. Ej: "BENEFICIO EXCLUSIVO ...". */
  eyebrow?: string
  title: string
  subtitle?: string
  primaryCta?: { text: string; href: string }
  /** Imagen del producto destacado / arte de campaña. */
  image?: string
  /** Alt text de la imagen. */
  imageAlt?: string
  /** Trust badges bajo el CTA. */
  trustBadges?: CampaignTrustBadge[]
}

/** Sección grid de kits (productos featured). */
export type CampaignKitsSectionConfig = {
  title: string
  subtitle?: string
  /**
   * Filtrado de qué productos mostrar. Si no está, la sección lista los N más
   * recientes del catálogo. `collectionId` gana sobre `tag` si ambos vienen.
   */
  filter?: {
    collectionId?: string
    tag?: string
    limit?: number
  }
  /** Texto del botón por card. Ausente = "Agregar". */
  ctaLabel?: string
}

/** Footer institucional. */
export type CampaignFooterConfig = {
  description?: string
  address?: string
  email?: string
  copyright?: string
  poweredBy?: { label: string; href: string }
}

/** Config completa de la home del template Campaña. */
export type CampaignHomeConfig = {
  announcement?: CampaignAnnouncementConfig
  chrome?: CampaignChromeConfig
  hero: CampaignHeroConfig
  kits: CampaignKitsSectionConfig
  footer?: CampaignFooterConfig
}

export type TenantConfig = {
  /**
   * Forma canónica para SEO: 'host' (el subdominio de la tienda) o 'path'
   * (`/tienda/<slug>` en el host principal). Ausente = 'host'.
   *
   * Las DOS formas resuelven siempre; esto sólo decide cuál lleva el
   * `<link rel="canonical">` y cuál queda `noindex`.
   */
  canonicalForm?: 'host' | 'path'

  /** Identificador único del tenant */
  id: string
  /** Dominio principal y alternativos */
  domains: string[]
  /** Nombre de la marca */
  name: string
  /**
   * Template de home a renderizar. Default `grocery`. Las demos de la
   * vertical Tecnología usan `technology` y las de Moda `fashion`.
   */
  template?: TenantTemplate
  /** Código de vertical (ej: "technology", "grocery"). Informativo. */
  vertical?: string
  /** Configuración de Medusa */
  medusa: TenantMedusaConfig
  /** Configuración de tema */
  theme: TenantTheme
  /** Rutas de assets */
  assets: TenantAssets
  /** Metadata adicional */
  metadata?: TenantMetadata
}
