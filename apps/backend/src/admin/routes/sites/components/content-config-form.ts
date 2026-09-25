/**
 * Converters puros entre el `content_config` de la API y el estado plano del
 * formulario de la ficha de la tienda.
 *
 * Viven en un `.ts` y no en `content-config-fields.tsx` a propósito: son la parte
 * que se puede testear. `formToContentConfig` RECONSTRUYE el objeto desde cero, así
 * que toda clave que no arrastre explícitamente se borra al guardar la ficha — y eso
 * ya rompió el footer una vez, en silencio. El `.tsx` no se puede importar desde un
 * test (ningún test del repo lo hace), así que la lógica se parte acá, siguiendo la
 * convención que ya tienen `routes/sites/lib.ts` + `lib.test.ts`.
 */
import type { DemoContentConfig } from '../../../hooks/api';
import {
  LEGACY_BRANCH_TYPES,
  resolveBranchTypes,
  type BranchType,
} from '../../../../lib/branch-types';

/** Split a textarea (one item per line) into a trimmed, non-empty string list. */
const parseLines = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * Local (string-friendly) shape of the per-demo content config used by the
 * create/edit forms. Kept flat so the forms hold a single state object; the
 * converters below map it to/from the API `DemoContentConfig`.
 */
export type ContentConfigForm = {
  sections: {
    blog: boolean;
    contact: boolean;
    shoppingList: boolean;
    sucursales: boolean;
    /** Link "Cuentas corporativas" (/corporate/register) del footer. */
    corporate: boolean;
    /** Menú "Categorías" del nav de escritorio (antes de "Tienda"). */
    categories: boolean;
    /** Etiquetas de formato/color en las cards del catálogo. */
    variantLabels: boolean;
  };
  blogSectionName: string;
  /** Variante visual del menú de categorías (hamburger | button). */
  categoriesMenuLayout: 'hamburger' | 'button';
  /**
   * Orden del LUGAR FLEXIBLE de la barra inferior mobile. Siempre los 5 ids, en
   * el orden que eligió la tienda: el formulario reordena, no selecciona. Qué
   * candidato gana lo decide el storefront con el gate de cada uno (promociones
   * activas, tintometría con carta, el switch de la sección).
   */
  mobileNav: MobileNavSlotId[];
  /**
   * Cómo se dibuja cada candidato si le toca el lugar flexible: `icon` (el
   * ícono con su label, lo que hacía la barra cuando estaba hardcodeada) o
   * `text` (sólo el texto). Siempre las 5 claves, para que el `Select` de cada
   * fila tenga valor y no arranque en blanco; el converter emite sólo las que
   * NO son `icon`.
   */
  mobileNavDisplay: Record<MobileNavSlotId, MobileNavDisplay>;
  /**
   * Zonas del filtro de ubicación. A diferencia del resto de los campos de
   * este formulario NO es un string: dejó de ser un textarea de GeoJSON crudo
   * y pasó a ser una lista editable (presets del catálogo argentino + zonas
   * dibujadas en el mapa), así que el estado es el objeto tal cual se persiste.
   */
  sucursalesRegions: NonNullable<DemoContentConfig['sucursales']>['regions'];
  /**
   * Tipos de sucursal de la tienda, en orden.
   *
   * `[]` y `undefined` NO son lo mismo y el converter lo respeta: vacío = la
   * tienda decidió no clasificar sus sucursales; ausente = todavía no se
   * configuró y valen los tres de siempre. Por eso el formulario se siembra
   * con `resolveBranchTypes`, que hace esa distinción en un solo lugar.
   */
  sucursalesTypes: BranchType[];
  sucursalesSubtitle: string;
  sucursalesShowLocationFilters: boolean;
  sucursalesShowCategoryFilters: boolean;
  sucursalesLayout: 'full' | 'compact';
  contactAddress: string;
  contactPhone: string;
  contactEmail: string;
  /** Horario de atención. Lo muestran el footer y la página de contacto. */
  contactHours: string;
  /**
   * Copy de la tarjeta "Atención al cliente" de `/contact`. Vacío = el copy por
   * defecto del storefront, no una tarjeta con el título en blanco.
   */
  contactPageTitle: string;
  contactPageDescription: string;
  contactPageNote: string;
  shoppingListTitle: string;
  shoppingListSubtitle: string;
  /** Textarea: una palabra rápida por línea. */
  shoppingListQuickTerms: string;
  searchSuggestions: { label: string; query: string }[];
  /** Textarea: un texto rotativo del buscador por línea. */
  searchHints: string;
  /** Diseño de la sección de marcas del home (carousel | marquee | dots). */
  brandsLayout: 'carousel' | 'marquee' | 'dots';
  /** MercadoPago: qué checkout ofrece el demo (api | express | both). */
  mercadopagoCheckoutMode: 'api' | 'express' | 'both';
  /**
   * Minicart "Recommended products carousel" toggle. Default `true` para
   * preservar el comportamiento existente en tiendas derivadas que aún no
   * optaron por apagarlo.
   */
  cartRecommendationsCarousel: boolean;

  // ─── Campaign template (site-level) ──────────────────────────────────────
  // Sólo campos que aparecen en TODAS las pantallas del sitio (announcement +
  // chrome del header + footer institucional). El body de la home (hero + grid
  // de kits) vive en el editor Puck (`home_puck_data`, bloques CampaignHero y
  // ProductosDestacados), no en este form.
  //
  // Se guardan flat para que el form maneje un único state; el converter arma
  // el objeto anidado `content_config.campaign` con las 3 sub-claves.
  campaignAnnouncementText: string;
  campaignAnnouncementHref: string;
  campaignChromeSubtitle: string;
  campaignChromePoweredByLabel: string;
  campaignChromePoweredByHref: string;
  /** Logo del pill "Powered by" del header. Cargado = reemplaza al label. */
  campaignChromePoweredByImage: string;
  campaignChromeBackgroundColor: string;
  campaignFooterPoweredByLabel: string;
  campaignFooterPoweredByHref: string;
  /** Logo del crédito "Powered by" del footer. Cargado = reemplaza al label. */
  campaignFooterPoweredByImage: string;
  campaignFooterBackgroundColor: string;
};

/**
 * Ids que pueden ocupar el lugar flexible de la barra inferior mobile (el cuarto
 * ítem, entre el carrito y el menú). Espejo del union del storefront.
 */
export type MobileNavSlotId = 'promos' | 'colores' | 'sucursales' | 'blog' | 'contacto';

/**
 * Cómo se dibuja una entrada en la barra inferior mobile. Espejo de
 * `MobileNavDisplay` del storefront (`lib/site-config/types.ts`).
 */
export type MobileNavDisplay = 'icon' | 'text';

/**
 * Orden por defecto. `promos` primero para no cambiarle la barra a ninguna
 * tienda existente: con promociones activas se sigue viendo lo de antes.
 * Espejo de `DEFAULT_MOBILE_NAV_ORDER` del storefront.
 */
export const DEFAULT_MOBILE_NAV: MobileNavSlotId[] = [
  'promos',
  'colores',
  'sucursales',
  'blog',
  'contacto',
];

/**
 * Normaliza la lista guardada a los 5 ids: descarta desconocidos y repetidos, y
 * COMPLETA con el default lo que falte. Así el form siempre muestra la lista
 * entera aunque la fila venga de una versión anterior (o vacía).
 */
const normalizeMobileNav = (saved?: readonly string[] | null): MobileNavSlotId[] => {
  const seen = new Set<string>();
  const out: MobileNavSlotId[] = [];
  for (const id of saved ?? []) {
    if (!DEFAULT_MOBILE_NAV.includes(id as MobileNavSlotId) || seen.has(id)) continue;
    seen.add(id);
    out.push(id as MobileNavSlotId);
  }
  for (const id of DEFAULT_MOBILE_NAV) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
};

/** Default por entrada: ícono, que es lo que hacía la barra hardcodeada. */
const DEFAULT_MOBILE_NAV_DISPLAY: MobileNavDisplay = 'icon';

/**
 * Completa las 5 claves desde lo guardado. Cualquier valor que no sea `text`
 * cae al default: la fila viene de un JSON y un valor inventado dejaría el
 * `Select` sin opción seleccionada.
 */
const normalizeMobileNavDisplay = (
  saved?: Partial<Record<string, string>> | null,
): Record<MobileNavSlotId, MobileNavDisplay> => {
  const out = {} as Record<MobileNavSlotId, MobileNavDisplay>;
  for (const id of DEFAULT_MOBILE_NAV) {
    out[id] = saved?.[id] === 'text' ? 'text' : DEFAULT_MOBILE_NAV_DISPLAY;
  }
  return out;
};

const SUGGESTION_ROWS = 3;

/**
 * Copy por defecto del subtítulo de /sucursales. Espejo del default del
 * storefront (apps/storefront/src/modules/store-locations/templates/index.tsx).
 * El formulario lo siembra cuando la demo no tiene subtítulo configurado, así
 * guardar sin tocar el campo no cambia lo que ya se ve; vaciarlo lo oculta.
 */
export const DEFAULT_SUCURSALES_SUBTITLE =
  'Busca por ubicacion, filtra por tipo de sucursal y encontra el punto mas conveniente para comprar o retirar.';

const emptySuggestions = () =>
  Array.from({ length: SUGGESTION_ROWS }, () => ({ label: '', query: '' }));

export function emptyContentForm(): ContentConfigForm {
  return {
    sections: {
      blog: true,
      contact: true,
      shoppingList: true,
      sucursales: true,
      corporate: true,
      categories: true,
      variantLabels: true,
    },
    blogSectionName: '',
    categoriesMenuLayout: 'hamburger',
    mobileNav: [...DEFAULT_MOBILE_NAV],
    mobileNavDisplay: normalizeMobileNavDisplay(),
    sucursalesSubtitle: DEFAULT_SUCURSALES_SUBTITLE,
    sucursalesRegions: [],
    sucursalesTypes: [...LEGACY_BRANCH_TYPES],
    sucursalesShowLocationFilters: true,
    sucursalesShowCategoryFilters: true,
    sucursalesLayout: 'full',
    contactAddress: '',
    contactPhone: '',
    contactEmail: '',
    contactHours: '',
    contactPageTitle: '',
    contactPageDescription: '',
    contactPageNote: '',
    shoppingListTitle: '',
    shoppingListSubtitle: '',
    shoppingListQuickTerms: '',
    searchSuggestions: emptySuggestions(),
    searchHints: '',
    brandsLayout: 'carousel',
    mercadopagoCheckoutMode: 'express',
    cartRecommendationsCarousel: true,
    // Campaign — todos vacíos; los defaults visuales viven en `campaignConfig`
    // del storefront y se aplican cuando cada campo se emite ausente.
    campaignAnnouncementText: '',
    campaignAnnouncementHref: '',
    campaignChromeSubtitle: '',
    campaignChromePoweredByLabel: '',
    campaignChromePoweredByHref: '',
    campaignChromePoweredByImage: '',
    campaignChromeBackgroundColor: '',
    campaignFooterPoweredByLabel: '',
    campaignFooterPoweredByHref: '',
    campaignFooterPoweredByImage: '',
    campaignFooterBackgroundColor: '',
  };
}

/** Seed the form from a demo's persisted content config (edit drawer). */
export function contentConfigToForm(cfg?: DemoContentConfig | null): ContentConfigForm {
  const base = emptyContentForm();
  if (!cfg) return base;
  return {
    sections: {
      blog: cfg.sections?.blog ?? true,
      contact: cfg.sections?.contact ?? true,
      shoppingList: cfg.sections?.shoppingList ?? true,
      sucursales: cfg.sections?.sucursales ?? true,
      corporate: cfg.sections?.corporate ?? true,
      categories: cfg.sections?.categories ?? true,
      variantLabels: cfg.sections?.variantLabels ?? true,
    },
    blogSectionName: cfg.blogSectionName ?? '',
    categoriesMenuLayout: cfg.categoriesMenuLayout ?? 'hamburger',
    mobileNav: normalizeMobileNav(cfg.mobileNav),
    mobileNavDisplay: normalizeMobileNavDisplay(cfg.mobileNavDisplay),
    // Ausente = todavía no se configuró: sembramos el copy por defecto para no
    // "apagar" el subtítulo al guardar. '' guardado = el usuario lo ocultó.
    sucursalesSubtitle: cfg.sucursales?.subtitle ?? DEFAULT_SUCURSALES_SUBTITLE,
    sucursalesRegions: cfg.sucursales?.regions ?? [],
    // Un sitio que nunca tocó esta pantalla se siembra con los tres tipos de
    // siempre y los persiste explícitos en el primer guardado — que es el
    // backfill que hace falta, hecho por la vía normal.
    sucursalesTypes: resolveBranchTypes(cfg.sucursales),
    sucursalesShowLocationFilters: cfg.sucursales?.showLocationFilters ?? true,
    sucursalesShowCategoryFilters: cfg.sucursales?.showCategoryFilters ?? true,
    sucursalesLayout: cfg.sucursales?.layout ?? 'full',
    mercadopagoCheckoutMode: cfg.mercadopagoCheckoutMode ?? 'express',
    cartRecommendationsCarousel: cfg.cart?.recommendationsCarousel ?? true,
    contactAddress: cfg.contact?.address ?? '',
    contactPhone: cfg.contact?.phone ?? '',
    contactEmail: cfg.contact?.email ?? '',
    contactHours: cfg.contact?.hours ?? '',
    contactPageTitle: cfg.contactPage?.title ?? '',
    contactPageDescription: cfg.contactPage?.description ?? '',
    contactPageNote: cfg.contactPage?.note ?? '',
    shoppingListTitle: cfg.shoppingList?.title ?? '',
    shoppingListSubtitle: cfg.shoppingList?.subtitle ?? '',
    shoppingListQuickTerms: (cfg.shoppingList?.quickTerms ?? []).join('\n'),
    searchHints: (cfg.searchHints ?? []).join('\n'),
    brandsLayout: cfg.brandsLayout ?? 'carousel',
    searchSuggestions:
      cfg.searchSuggestions && cfg.searchSuggestions.length
        ? Array.from({ length: SUGGESTION_ROWS }, (_, i) => ({
            label: cfg.searchSuggestions?.[i]?.label ?? '',
            query: cfg.searchSuggestions?.[i]?.query ?? '',
          }))
        : base.searchSuggestions,
    // ─── Campaign (site-level) ─────────────────────────────────────────────
    campaignAnnouncementText: cfg.campaign?.announcement?.text ?? '',
    campaignAnnouncementHref: cfg.campaign?.announcement?.href ?? '',
    campaignChromeSubtitle: cfg.campaign?.chrome?.subtitle ?? '',
    campaignChromePoweredByLabel: cfg.campaign?.chrome?.poweredByLabel ?? '',
    campaignChromePoweredByHref: cfg.campaign?.chrome?.poweredByHref ?? '',
    campaignChromePoweredByImage: cfg.campaign?.chrome?.poweredByImage ?? '',
    campaignChromeBackgroundColor: cfg.campaign?.chrome?.backgroundColor ?? '',
    campaignFooterPoweredByLabel: cfg.campaign?.footer?.poweredBy?.label ?? '',
    campaignFooterPoweredByHref: cfg.campaign?.footer?.poweredBy?.href ?? '',
    campaignFooterPoweredByImage: cfg.campaign?.footer?.poweredBy?.image ?? '',
    campaignFooterBackgroundColor: cfg.campaign?.footer?.backgroundColor ?? '',
  };
}

/**
 * Convierte el formulario al payload de la API; descarta textos y filas vacíos.
 *
 * `current` es el `content_config` que vino del server, y NO es opcional por
 * comodidad: esta función RECONSTRUYE el objeto desde cero, así que toda clave
 * que el formulario no modele se borraba al guardar la ficha. Se perdían tres,
 * en silencio y sin error:
 *
 *  - `description`: la de SEO (`metadata.description` + social card). No la edita
 *    ninguna pantalla de la ficha.
 *  - `footer`: TODO el footer (descripción, redes, legales, newsletter,
 *    copyright), que guarda la pantalla "Personalizar footer".
 *
 * Sin esto, editar el título de "Atención al cliente" en la ficha te dejaba el
 * footer sin redes, sin legales y sin copyright. Se arrastran, no se mergean: las
 * claves que el formulario SÍ modela siguen ganando, incluso cuando el operador
 * las vacía a propósito.
 */
export function formToContentConfig(
  form: ContentConfigForm,
  templateCode: string,
  current?: DemoContentConfig | null,
): DemoContentConfig {
  const prev = current ?? {};
  const cfg: DemoContentConfig = { sections: { ...form.sections } };
  // La de SEO: se arrastra tal cual (ver el docblock).
  if (prev.description) cfg.description = prev.description;
  if (form.blogSectionName.trim()) cfg.blogSectionName = form.blogSectionName.trim();
  // Sucursales: se persiste siempre (a diferencia del resto), porque el
  // subtítulo vacío ES una elección — significa "no mostrarlo".
  cfg.sucursales = {
    regions: form.sucursalesRegions,
    // Siempre explícito, incluso vacío: la lista vacía ES una elección ("esta
    // tienda no clasifica sus sucursales") y tiene que poder distinguirse de
    // "todavía no se configuró". `categories`, la clave vieja, no se arrastra:
    // `types` la reemplaza y `resolveBranchTypes` ya la leyó al hidratar.
    types: form.sucursalesTypes,
    subtitle: form.sucursalesSubtitle.trim(),
    showLocationFilters: form.sucursalesShowLocationFilters,
    showCategoryFilters: form.sucursalesShowCategoryFilters,
    layout: form.sucursalesLayout,
  };
  // Only persist a non-default mode ('express' is the storefront default).
  if (form.mercadopagoCheckoutMode && form.mercadopagoCheckoutMode !== 'express') {
    cfg.mercadopagoCheckoutMode = form.mercadopagoCheckoutMode;
  }
  // Sólo persistimos si el operador APAGÓ el carousel. Default = true en el
  // storefront (opt-out), así que omitirlo cuando está en true evita
  // ensuciar el payload y respeta el "ausente = storefront default".
  if (form.cartRecommendationsCarousel === false) {
    cfg.cart = { recommendationsCarousel: false };
  }
  const contact: NonNullable<DemoContentConfig['contact']> = {};
  if (form.contactAddress.trim()) contact.address = form.contactAddress.trim();
  if (form.contactPhone.trim()) contact.phone = form.contactPhone.trim();
  if (form.contactEmail.trim()) contact.email = form.contactEmail.trim();
  if (form.contactHours.trim()) contact.hours = form.contactHours.trim();
  if (Object.keys(contact).length) cfg.contact = contact;
  /**
   * Copy de la tarjeta "Atención al cliente" de `/contact`. Clave hermana de
   * `contact`, no anidada: la pantalla del footer reconstruye `contact` entero y
   * se lo habría comido en el primer guardado.
   */
  const contactPage: NonNullable<DemoContentConfig['contactPage']> = {};
  if (form.contactPageTitle.trim()) contactPage.title = form.contactPageTitle.trim();
  if (form.contactPageDescription.trim()) {
    contactPage.description = form.contactPageDescription.trim();
  }
  if (form.contactPageNote.trim()) contactPage.note = form.contactPageNote.trim();
  if (Object.keys(contactPage).length) cfg.contactPage = contactPage;
  /**
   * Footer: la ficha NO modela ninguna de sus claves — el footer entero se edita
   * en "Personalizar footer" — así que se arrastra tal cual vino del server.
   *
   * Y se omite si está vacío: emitir `footer: {}` haría que gane entero sobre el
   * footer del template (el merge de `assets` es shallow POR CLAVE) y le dejaría
   * el footer en blanco a la tienda.
   */
  if (prev.footer && Object.keys(prev.footer).length) cfg.footer = prev.footer;
  const shoppingList: {
    title?: string;
    subtitle?: string;
    quickTerms?: string[];
  } = {};
  if (form.shoppingListTitle.trim()) shoppingList.title = form.shoppingListTitle.trim();
  if (form.shoppingListSubtitle.trim())
    shoppingList.subtitle = form.shoppingListSubtitle.trim();
  const quickTerms = parseLines(form.shoppingListQuickTerms);
  if (quickTerms.length) shoppingList.quickTerms = quickTerms;
  if (Object.keys(shoppingList).length) cfg.shoppingList = shoppingList;
  // Quick suggestions only apply to the grocery/supermarket header.
  if (templateCode === 'supermercado') {
    const suggestions = form.searchSuggestions
      .map((s) => ({ label: s.label.trim(), query: s.query.trim() }))
      .filter((s) => s.label && s.query);
    if (suggestions.length) cfg.searchSuggestions = suggestions;
  }
  const searchHints = parseLines(form.searchHints);
  if (searchHints.length) cfg.searchHints = searchHints;
  // Solo se persiste si NO es el default del storefront ('carousel').
  if (form.brandsLayout !== 'carousel') cfg.brandsLayout = form.brandsLayout;
  // Ídem: 'hamburger' es el default del storefront.
  if (form.categoriesMenuLayout !== 'hamburger') {
    cfg.categoriesMenuLayout = form.categoriesMenuLayout;
  }
  /**
   * Barra inferior mobile: sólo se persiste si el orden NO es el default, y
   * nunca vacío. `mobileNav: []` presente ganaría entero sobre el default del
   * storefront (el merge de `assets` es shallow por clave) y dejaría la barra
   * en 4 columnas con el carrito descentrado — el bug que este campo arregla.
   */
  const mobileNav = normalizeMobileNav(form.mobileNav);
  if (mobileNav.join(',') !== DEFAULT_MOBILE_NAV.join(',')) {
    cfg.mobileNav = mobileNav;
  }
  /**
   * Ícono vs texto por entrada: se emiten SÓLO las que no son `icon`, y la
   * clave se omite si no hay ninguna. El storefront completa lo que falte con
   * `icon` (`resolveMobileNavDisplay`), así que un objeto parcial es seguro —
   * y guardar las 5 siempre dejaría la config llena de defaults.
   */
  const display: Partial<Record<MobileNavSlotId, MobileNavDisplay>> = {};
  for (const id of DEFAULT_MOBILE_NAV) {
    if (form.mobileNavDisplay?.[id] === 'text') display[id] = 'text';
  }
  if (Object.keys(display).length) cfg.mobileNavDisplay = display;
  /**
   * Campaign — sólo se emite si el template lo usa. Cada sub-clave (announcement,
   * chrome, hero, kits, footer) se emite SOLO si tiene contenido; y dentro, cada
   * campo strings.trim() || undefined. El backend además hace `cleanCampaignOverride`
   * como red doble antes de publicar, así que un `""` que se cuele acá no rompe
   * los defaults del storefront — pero preferible no ensuciar el payload.
   */
  if (templateCode === 'campaign') {
    const campaign = buildCampaignPayload(form);
    if (campaign) cfg.campaign = campaign;
  }
  return cfg;
}

function nonEmpty(s: string): string | undefined {
  const t = s.trim();
  return t.length ? t : undefined;
}

function buildCampaignPayload(
  form: ContentConfigForm,
): NonNullable<DemoContentConfig['campaign']> | undefined {
  const announcement: { text?: string; href?: string } = {};
  const at = nonEmpty(form.campaignAnnouncementText);
  const ah = nonEmpty(form.campaignAnnouncementHref);
  if (at) announcement.text = at;
  if (ah) announcement.href = ah;

  const chrome: {
    subtitle?: string;
    poweredByLabel?: string;
    poweredByHref?: string;
    poweredByImage?: string;
    backgroundColor?: string;
  } = {};
  const cs = nonEmpty(form.campaignChromeSubtitle);
  const cpl = nonEmpty(form.campaignChromePoweredByLabel);
  const cph = nonEmpty(form.campaignChromePoweredByHref);
  const cpi = nonEmpty(form.campaignChromePoweredByImage);
  const cbg = nonEmpty(form.campaignChromeBackgroundColor);
  if (cs) chrome.subtitle = cs;
  if (cpl) chrome.poweredByLabel = cpl;
  if (cph) chrome.poweredByHref = cph;
  if (cpi) chrome.poweredByImage = cpi;
  if (cbg) chrome.backgroundColor = cbg;

  const footer: NonNullable<
    NonNullable<DemoContentConfig['campaign']>['footer']
  > = {};
  const fpl = nonEmpty(form.campaignFooterPoweredByLabel);
  const fph = nonEmpty(form.campaignFooterPoweredByHref);
  const fpi = nonEmpty(form.campaignFooterPoweredByImage);
  const fbg = nonEmpty(form.campaignFooterBackgroundColor);
  // poweredBy se emite si hay AL MENOS uno entre {label, image}. `href` es
  // opcional; sin él, el crédito se renderiza como span en vez de <a>.
  if (fpl || fpi) {
    const pb: { label?: string; href?: string; image?: string } = {};
    if (fpl) pb.label = fpl;
    if (fph) pb.href = fph;
    if (fpi) pb.image = fpi;
    footer.poweredBy = pb;
  }
  if (fbg) footer.backgroundColor = fbg;

  const out: NonNullable<DemoContentConfig['campaign']> = {};
  if (Object.keys(announcement).length) out.announcement = announcement;
  if (Object.keys(chrome).length) out.chrome = chrome;
  if (Object.keys(footer).length) out.footer = footer;
  return Object.keys(out).length ? out : undefined;
}
