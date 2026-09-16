/**
 * Demo template registry types.
 *
 * Fase 1: templates are an in-code registry (no DB table). A template produces
 * the storefront-facing branding/content payload from a demo record + its theme.
 * The shapes mirror the storefront's TenantConfig (apps/storefront/src/lib/
 * site-config/types.ts); kept loosely typed here so the backend doesn't have to
 * duplicate the full storefront type — the storefront validates on its side.
 */
import type { BranchType } from '../../../lib/branch-types';
import type { StoreLocatorZoneConfig } from '../../../lib/store-locator-config';

export type DemoThemeConfig = {
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  /** Fondo del header. Ausente = el default del template. */
  header_background?: string;
  /** Fondo del footer. Ausente = el default del template. */
  footer_background?: string;
  /** Fondo del boton "Promociones" del header. Ausente = el color primario. */
  promo_button_color?: string;
  /** Logo positivo (fondos claros). */
  logo?: string;
  /** Logo negativo (fondos oscuros). Solo se guarda/expone por ahora. */
  logo_negative?: string;
  /** Icono/isotipo positivo (reemplaza a mobile_logo). */
  icon?: string;
  /** Icono/isotipo negativo. Solo se guarda/expone por ahora. */
  icon_negative?: string;
  /** @deprecated Compatibilidad: se lee como fallback de `icon`. */
  mobile_logo?: string;
  /**
   * Cuál de los dos isotipos usa el botón de home de la barra inferior mobile.
   * El círculo tiene SIEMPRE fondo blanco, así que el default es el positivo:
   * el negativo (blanco) sólo se lee si la marca lo diseñó para ese fondo.
   * Ausente = 'positive'.
   */
  /** Favicon positivo. */
  favicon?: string;
  /** Favicon negativo (dark mode). Solo se guarda/expone por ahora. */
  favicon_negative?: string;
  typography?: string;
};

/**
 * Ids que la tienda puede poner en el lugar FLEXIBLE de la barra inferior
 * mobile. Espejo de `MobileNavSlotId` del storefront
 * (`lib/site-config/types.ts`); el registro con label/href/ícono y el gate de
 * disponibilidad de cada uno vive en `bottom-nav/slots.ts`.
 */
export type MobileNavSlotId = 'promos' | 'colores' | 'sucursales' | 'blog' | 'contacto';

/**
 * Per-demo content config edited from the admin (Contenido tab). Maps onto the
 * storefront TenantAssets in buildTenantConfig: `sections` → `sectionVisibility`,
 * the rest pass through by key. All optional; absent = storefront default.
 */
export type DemoContentConfig = {
  /** Section visibility toggles. Absent/true = shown. */
  sections?: {
    blog?: boolean;
    contact?: boolean;
    shoppingList?: boolean;
    sucursales?: boolean;
    /** "Cuentas corporativas" (/corporate/register) link in the footer. */
    corporate?: boolean;
    /** Menú "Categorías" del nav de escritorio (antes de "Tienda"). */
    categories?: boolean;
    /**
     * Etiquetas de variantes en las cards del catálogo: formato/medida abajo a
     * la izquierda y colores (círculo SVG) arriba a la izquierda. Ausente/true
     * = visibles.
     */
    variantLabels?: boolean;
  };
  /**
   * Descripción de la tienda. Alimenta `metadata.description`, o sea el
   * `<meta name="description">` y la social card (OG image) del sitio público.
   * Ausente = `Tienda online de {name}`.
   */
  description?: string;
  /** Override for the blog section name (nav label + blog page title). */
  blogSectionName?: string;
  /**
   * Variante visual del menú "Categorías" del nav:
   *  - 'hamburger' (default): link con ícono de hamburguesa y panel con submenú
   *    lateral (referencia Frávega)
   *  - 'button': pill sólido en el color de marca y desplegable con acordeón
   *    (referencia Arcor en casa)
   */
  categoriesMenuLayout?: 'hamburger' | 'button';
  /**
   * Orden de preferencia del LUGAR FLEXIBLE de la barra inferior mobile (el
   * cuarto ítem, entre el carrito y el menú). El storefront toma el primer id
   * de la lista que esté realmente disponible en la tienda.
   *
   * Ese lugar era `Promos` hardcodeado, y `Promos` se apaga solo cuando el canal
   * no tiene promociones activas: la barra caía a 4 columnas y el carrito — que
   * es el FAB del centro — quedaba descentrado. Con una lista ordenada entra el
   * siguiente candidato y la barra se queda en 5.
   *
   * Ausente = el orden por defecto del storefront. Una lista PARCIAL se completa
   * con el default (es una preferencia, no un recorte), y los ids desconocidos
   * se ignoran.
   */
  mobileNav?: MobileNavSlotId[];

  /**
   * Cómo se dibuja cada entrada si le toca ese lugar: `icon` (el ícono con su
   * label, lo que hacía la barra cuando estaba hardcodeada) o `text` (sólo el
   * texto). Parcial a propósito: sólo viajan las que el operador cambió, y el
   * storefront completa el resto con `icon`.
   */
  mobileNavDisplay?: Partial<Record<MobileNavSlotId, 'icon' | 'text'>>;

  /** Contact data shown on the contact page + footer (address/phone/email). */
  contact?: {
    address?: string;
    phone?: string;
    email?: string;
    /**
     * Horario de atención ("Lun a Vie de 8 a 18 hs"). Va acá y no en `footer`
     * porque ES dato de contacto: la columna "Atención al cliente" del footer lo
     * muestra al lado del teléfono y del mail, que salen de las claves de arriba.
     * Ponerlo en `footer` habría partido el mismo dato en dos lugares.
     */
    hours?: string;
  };
  /**
   * Copy de la sección "Atención al cliente" de `/contact`: título, párrafo y el
   * cartel al pie de la tarjeta. Ausente = el copy por defecto del storefront.
   *
   * Va como clave HERMANA de `contact` y no adentro, y el motivo es concreto: la
   * pantalla "Personalizar footer" (`admin/routes/sites/[id]/footer`) RECONSTRUYE
   * `contact` entero desde sus cuatro campos (teléfono, mail, dirección, horario)
   * y lo pisa. Un `contact.title` habría sobrevivido hasta el primer guardado del
   * footer y desaparecido ahí, sin error. Como hermana, el `...current` de esa
   * pantalla la arrastra intacta.
   *
   * Los DATOS (teléfono, mail, dirección) siguen en `contact`: son los mismos que
   * muestra el footer, y duplicarlos acá habría partido el mismo dato en dos.
   */
  contactPage?: {
    /** Título de la tarjeta. Ausente/vacío = "Atención al cliente". */
    title?: string;
    /**
     * Párrafo bajo el título. NO confundir con `description` (la de SEO) ni con
     * `footer.description` (el párrafo bajo el logo): son tres textos distintos.
     */
    description?: string;
    /** Cartel gris al pie de la tarjeta. Ausente/vacío = el copy por defecto. */
    note?: string;
  };
  /**
   * Textos del footer. HOY sólo la descripción: el párrafo bajo el logo.
   *
   * OJO con confundirlo con `description` (arriba): esa es la de SEO
   * (`metadata.description` → meta description + social card) y NO se renderiza
   * en el footer. Son dos textos distintos y el reporte que motivó este campo
   * fue justamente editar uno esperando ver el otro.
   *
   * Ausente = el copy del template (`buildAssets`) para las demos, o el de
   * `defaultConfig` del storefront para la principal.
   */
  footer?: {
    description?: string;
    /**
     * Redes sociales. `icon` es el nombre de un ícono que el storefront conoce
     * ('instagram', 'facebook', 'twitter', 'linkedin', 'youtube', 'tiktok'); se
     * deja como `string` a propósito, igual que el resto de este archivo — el
     * union real vive en `SocialLink` del storefront, que es quien valida.
     */
    social?: { name: string; href: string; icon?: string }[];
    /**
     * Links de la columna "Legales". Los `href` tienen que existir bajo
     * `app/[countryCode]/(main)/legal` — ver `navigation-links.ts`.
     */
    legal?: { name: string; href: string }[];
    newsletter?: {
      title?: string;
      placeholder?: string;
      buttonText?: string;
    };
    /** Línea de copyright. `{year}` se reemplaza por el año en curso. */
    copyright?: string;
  };
  /**
   * Página de sucursales (`/sucursales`). Ausente = defaults del storefront.
   * La visibilidad del link sigue en `sections.sucursales`.
   */
  sucursales?: {
    /**
     * Subtítulo bajo el título "Sucursales". Ausente = copy por defecto;
     * cadena vacía = no se muestra.
     */
    subtitle?: string;
    /**
     * Zonas del filtro de ubicación. Dos formas: `preset` (una jurisdicción del
     * catálogo de Argentina, por referencia) o `geometry` (dibujada a mano).
     * `active: false` apaga una zona propia sin perder su polígono.
     */
    regions?: StoreLocatorZoneConfig[];
    /**
     * Tipos de sucursal de la tienda, en orden. Vacío = la tienda no clasifica
     * sus sucursales; ausente = caen los tres de siempre (`resolveBranchTypes`).
     */
    types?: BranchType[];
    /** Clave vieja del filtro por categoría: se lee, ya no se escribe. */
    categories?: { type: string; label: string }[];
    showLocationFilters?: boolean;
    /** Mostrar el filtro de categoría (tipo de sucursal). Default true. */
    showCategoryFilters?: boolean;
    /**
     * `full` (default): buscador + filtros + mapa + listado debajo.
     * `compact`: pocas sucursales — listado al lado del mapa, sin buscador
     * ni filtros.
     */
    layout?: 'full' | 'compact';
  };
  /** Editable copy for the shopping-list page. */
  shoppingList?: {
    title?: string;
    subtitle?: string;
    /** "Agregá rápido" quick-add chips (shopping list modal + page). */
    quickTerms?: string[];
  };
  /**
   * Diseño de la sección "Nuestras marcas" del home:
   *  - 'carousel' (default): fila con flechas, tarjetas que se levantan al hover
   *  - 'marquee': marquesina infinita, grises que toman color al hover
   *  - 'dots': páginas limpias con indicadores de puntos
   */
  brandsLayout?: 'carousel' | 'marquee' | 'dots';
  /** The "Explorar:" quick suggestions in the header search (grocery only). */
  searchSuggestions?: { label: string; query: string }[];
  /** Rotating placeholder hints in the header/floating/mobile search bars. */
  searchHints?: string[];
  /**
   * Which MercadoPago checkout(s) this demo offers at the payment step:
   *  - 'express' (default): Checkout Pro redirect (pp_mercadopago_mercadopago)
   *  - 'api': embedded Payment Brick (pp_mercadopagoapi_mercadopagoapi)
   *  - 'both': show both, buyer chooses
   * Only affects which MP provider(s) the storefront displays; the providers
   * must also be enabled/linked on the backend.
   */
  mercadopagoCheckoutMode?: 'api' | 'express' | 'both';
  /**
   * Content SITE-LEVEL del template Campaña (landing institucional). Sólo se lee
   * cuando `template_code === 'campaign'`. Cubre lo que aparece en TODAS las
   * pantallas del sitio (barra de anuncio, chrome del header, footer
   * institucional). El cuerpo de la home (hero + grid de kits) es contenido de
   * home y se edita desde el editor Puck (`home_puck_data`), no desde acá.
   *
   * Overrides parciales: cualquier sub-clave ausente vuelve a `campaignConfig`
   * en el storefront (overlay por sub-clave en `active-tenant.ts`).
   *
   * El tipo REAL (con todos los sub-slots) vive en el storefront como
   * `CampaignHomeConfig`; acá se mantiene loose para no duplicar contrato entre
   * repos — el Zod schema del admin (`api/admin/sites/schemas.ts`) es el
   * validador de forma y la fuente de verdad de qué campos se aceptan.
   */
  campaign?: {
    announcement?: { text?: string; href?: string };
    chrome?: {
      subtitle?: string;
      poweredByLabel?: string;
      poweredByHref?: string;
      /** Hex. Ausente = default del template (blanco). */
      backgroundColor?: string;
    };
    footer?: {
      poweredBy?: { label: string; href: string };
      /** Hex. Ausente = default del template (blanco en campaign). */
      backgroundColor?: string;
    };
  };
};

export type DemoStoreLike = {
  id: string;
  name: string;
  slug: string;
  /**
   * La tienda principal (la del host raíz). Cambia cómo se arman los assets: no
   * hereda la decoración del template. Ver `main-store.ts`.
   */
  is_main?: boolean | null;
  /**
   * Qué forma de URL es la canónica para SEO. Ausente = `'host'` (el subdominio),
   * que es el default histórico.
   */
  canonical_form?: 'host' | 'path' | null;
  template_code: string;
  country_code: string;
  currency_code: string;
  locale: string;
  sales_channel_id: string | null;
  theme?: DemoThemeConfig | null;
  content_config?: DemoContentConfig | null;
  /** Puck document ({ content, root }) for the demo home, if customized. */
  home_puck_data?: Record<string, unknown> | null;
  /** B2B: exposes the wholesale portal + channel when enabled. */
  b2b_enabled?: boolean | null;
  b2b_pricing_tiers?: { minQty: number; discount: number }[] | null;
  b2b_sales_channel_id?: string | null;
  /** Compras recurrentes: exposes the subscribe UI + store API when enabled. */
  recurring_enabled?: boolean | null;
  /** Tintometría: expone la página color → bases y su link en el menú. */
  tinting_enabled?: boolean | null;
  /**
   * Mi cuenta: "Mis puntos" y "Gift Cards". El default de la columna es TRUE, así
   * que la ausencia del valor significa VISIBLE — se lee con `!== false`, nunca
   * con `!!`.
   */
  loyalty_enabled?: boolean | null;
  gift_cards_enabled?: boolean | null;
  /** Página de contraseña: bloquea el storefront del demo hasta acertar la clave. */
  password_gate_enabled?: boolean | null;
  /**
   * La palabra configurada. SÓLO se usa para derivar el largo en el config
   * público y para verificar en POST /store/store-config/site-gate; nunca se
   * publica.
   */
  password_gate_password?: string | null;
};

/** Loosely-typed storefront TenantConfig payload (validated on the storefront). */
export type TenantConfigPayload = {
  id: string;
  domains: string[];
  /** Forma canónica para SEO: 'host' (subdominio) o 'path' (ruta). */
  canonicalForm: 'host' | 'path';
  name: string;
  template?: 'grocery' | 'technology' | 'fashion' | 'tech-retail' | 'sports' | 'campaign';
  vertical?: string;
  medusa: {
    salesChannelId: string;
    /** Wholesale portal config, present only when the demo has B2B enabled. */
    b2b?: {
      enabled: boolean;
      salesChannelId: string;
      /** Quantity tiers (escalas) the storefront shows/applies. */
      tiers?: { minQty: number; discount: number }[];
    };
    /** Recurring purchases config, present only when the demo enables it. */
    recurring?: {
      enabled: boolean;
    };
    /**
     * Tintometría, presente sólo cuando el demo la tiene prendida. Gatea la
     * página color → bases y su link; las rutas /store/tinting/* siguen
     * exigiendo el switch de la config del ERP.
     */
    tinting?: {
      enabled: boolean;
    };
    /**
     * Secciones de "Mi cuenta". A diferencia del resto de este bloque, estas DOS
     * se publican SIEMPRE con su booleano explícito en vez de aparecer sólo
     * cuando están prendidas.
     *
     * Es deliberado: el default es `true`, así que la AUSENCIA de la clave tiene
     * que significar "visible" —un storefront nuevo contra un backend viejo, que
     * todavía no las publica, tiene que seguir mostrando las secciones como
     * siempre—. Por eso el consumidor lee `enabled !== false` y acá se emite el
     * valor completo.
     *
     * Sólo gatean la vidriera: los módulos de fidelización y gift cards siguen
     * teniendo sus propios switches de instancia en app-settings.
     */
    loyalty?: {
      enabled: boolean;
    };
    giftCards?: {
      enabled: boolean;
    };
    /**
     * Página de contraseña, presente sólo cuando el demo la tiene prendida.
     * `length` es el largo de la palabra (cuántas casillas dibujar). La palabra
     * en sí NO viaja: este payload es público.
     */
    passwordGate?: {
      enabled: boolean;
      length: number;
    };
  };
  theme: {
    colors: {
      primary: string;
      secondary?: string;
      accent?: string;
      headerBackground?: string;
      footerBackground?: string;
      promoButton?: string;
    };
    typography?: { fontFamily?: string };
  };
  assets: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type DemoTemplate = {
  code: string;
  name: string;
  preview_image: string;
  tenant_template: 'grocery' | 'technology' | 'fashion' | 'tech-retail' | 'sports' | 'campaign';
  vertical: 'grocery' | 'technology' | 'fashion' | 'tech-retail' | 'sports' | 'campaign';
  /** Build the storefront assets block for a given demo. */
  buildAssets: (demo: DemoStoreLike) => Record<string, unknown>;
};
