import { WHOLESALE_TIERS } from '../b2b-pricing';
import { readMercadoPagoSetting } from '../../app-settings/mercadopago-runtime';
import type { DemoStoreLike, DemoTemplate, TenantConfigPayload } from './types';
import { parseMpAccounts, resolveMpAccount } from '../../mercado-pago/utils/accounts';
import { buildMainStoreBrandAssets } from './shared';
import { fashionTemplate } from './fashion';
import { supermercadoTemplate } from './supermercado';
import { technologyTemplate } from './technology';
import { techRetailTemplate } from './tech-retail';
import { sportsTemplate } from './sports';
import { campaignTemplate } from './campaign';

export * from './types';

/**
 * In-code template registry (Fase 1). Fase 3 migrates this to a DB-backed
 * DemoTemplate table so verticals can be added without a deploy.
 */
const TEMPLATES: DemoTemplate[] = [
  supermercadoTemplate,
  technologyTemplate,
  fashionTemplate,
  techRetailTemplate,
  sportsTemplate,
  campaignTemplate,
];

const TEMPLATE_BY_CODE = new Map(TEMPLATES.map((t) => [t.code, t]));

export const DEFAULT_TEMPLATE_CODE = 'supermercado';

/** Lightweight list for the admin template selector. */
export function listTemplates(): Array<Pick<DemoTemplate, 'code' | 'name' | 'preview_image'>> {
  return TEMPLATES.map(({ code, name, preview_image }) => ({ code, name, preview_image }));
}

export function getTemplate(code: string): DemoTemplate {
  return TEMPLATE_BY_CODE.get(code) ?? supermercadoTemplate;
}

/**
 * Resolves the MercadoPago assets exposed to the storefront: which checkout(s)
 * to show for this demo and the public key the embedded Payment Brick needs.
 * The public key is looked up per sales channel from MERCADOPAGO_ACCOUNTS with
 * the global MERCADOPAGO_PUBLIC_KEY as fallback (only present for the API flow).
 */
function buildMercadoPagoAssets(
  demo: DemoStoreLike,
  content: NonNullable<DemoStoreLike['content_config']>
): { checkoutMode: 'api' | 'express' | 'both'; publicKey: string | null } {
  const checkoutMode = content.mercadopagoCheckoutMode ?? 'express';
  const account = resolveMpAccount(
    parseMpAccounts(readMercadoPagoSetting('MERCADOPAGO_ACCOUNTS')),
    { accessToken: '', publicKey: readMercadoPagoSetting('MERCADOPAGO_PUBLIC_KEY') },
    { salesChannelId: demo.sales_channel_id ?? null }
  );
  return { checkoutMode, publicKey: account.publicKey ?? null };
}

/**
 * Strippea recursivamente strings vacíos, objetos vacíos y arrays vacíos de un
 * override de content.campaign. Motivo: cuando el operador vacía un input del
 * form, el body llega con `""` (no con la clave ausente). Si emito eso al
 * storefront, el overlay pisa el default de `campaignConfig` con `""` y el hero
 * queda sin título. Con `undefined` en su lugar, la sub-clave desaparece del
 * payload y el overlay del storefront devuelve el default del código.
 *
 * NO trimmea números ni booleanos: `limit: 0` es un valor válido que el user
 * puede querer mandar (aunque el schema Zod ya lo restringe a positivo).
 */
function cleanCampaignOverride(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    const cleaned = value.map(cleanCampaignOverride).filter((v) => v !== undefined);
    return cleaned.length ? cleaned : undefined;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = cleanCampaignOverride(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

/**
 * Build the full storefront TenantConfig payload for a ready demo. Consumed by
 * GET /store/demo-stores/{slug}/config and validated on the storefront.
 */
export function buildTenantConfig(demo: DemoStoreLike): TenantConfigPayload {
  const theme = demo.theme ?? {};
  const template = getTemplate(demo.template_code);
  const content = demo.content_config ?? {};
  const isMain = Boolean(demo.is_main);
  // La tienda PRINCIPAL no hereda la decoración del template: `buildAssets()`
  // inyecta contenido de demo (heroBanners "Nuestras verduras"/"Promo TV", topbar,
  // featuredProducts, novedades, footer.description) y fuerza `logos.main` a
  // `/logo_full.webp`, mientras el sitio real usa sus propios banners administrados
  // y `/logos-mercatto/logocompleto-verde.svg`. Y el merge del storefront es shallow
  // por clave, así que una clave presente acá gana entera sobre `defaultConfig`.
  // De la principal sólo se mapea la marca cargada, sin defaults.
  const templateAssets = isMain ? buildMainStoreBrandAssets(demo) : template.buildAssets(demo);
  // Per-demo contact data (address/phone/email) surfaced to BOTH the footer
  // (assets.footer.contact — label/value/href shape) and the contact page
  // (assets.contactPage — label/value shape), plus metadata.contact as the
  // fallback both read. Only defined fields are set so empty ones don't render
  // a stale default. Absent contact = storefront keeps its own defaults.
  const contact = content.contact ?? {};
  const hasContact = Boolean(contact.address || contact.phone || contact.email || contact.hours);
  const telHref = contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, '')}` : undefined;
  const footerContact: Record<string, unknown> = {};
  const contactPage: Record<string, unknown> = {};
  // Descripción del footer (el párrafo bajo el logo), editable desde el
  // backoffice. `trim()` porque un texto en blanco es tan inservible como uno
  // ausente: tiene que caer al copy del template/`defaultConfig`, no pisarlo con
  // una cadena vacía. NO es `content.description`, que es la de SEO.
  const footerDescription = content.footer?.description?.trim() || undefined;
  /**
   * El resto del footer editable. Cada uno cae a `undefined` cuando está vacío por
   * el mismo motivo que la descripción: una cadena en blanco o un array vacío son
   * "no lo configuré", y pisarían el copy del template con nada.
   *
   * Las filas de `social` y `legal` se filtran una por una: el formulario permite
   * agregar una fila y guardar antes de completarla, y una red social sin `href`
   * renderiza un ícono que no lleva a ningún lado.
   */
  const footerCfg = content.footer ?? {};
  const nonEmpty = <T>(rows: T[] | undefined): T[] | undefined =>
    rows && rows.length ? rows : undefined;
  const footerSocial = nonEmpty(
    footerCfg.social?.filter((s) => s?.name?.trim() && s?.href?.trim())
  );
  const footerLegal = nonEmpty(footerCfg.legal?.filter((l) => l?.name?.trim() && l?.href?.trim()));
  const footerNewsletter = footerCfg.newsletter?.title?.trim() ? footerCfg.newsletter : undefined;
  const footerCopyright = footerCfg.copyright?.trim() || undefined;
  const hasFooter = Boolean(
    hasContact ||
    footerDescription ||
    footerSocial ||
    footerLegal ||
    footerNewsletter ||
    footerCopyright
  );
  if (contact.phone) {
    footerContact.phone = { label: 'Teléfono', value: contact.phone, href: telHref };
    contactPage.phone = { label: 'Teléfono', value: contact.phone };
  }
  if (contact.email) {
    footerContact.email = {
      label: 'Correo electrónico',
      value: contact.email,
      href: `mailto:${contact.email}`,
    };
    contactPage.email = { label: 'Email', value: contact.email };
  }
  if (contact.address) {
    footerContact.location = { label: 'Ubicación', value: contact.address };
    contactPage.location = { label: 'Dirección', value: contact.address };
  }
  if (contact.hours) {
    // Sólo al footer: la página de contacto no lee `hours` hoy, y emitirlo ahí
    // sería una clave que nadie renderiza — el no-op silencioso de siempre.
    footerContact.hours = { label: 'Horario de atención', value: contact.hours };
  }
  /**
   * Copy de la tarjeta "Atención al cliente" de `/contact`. Sale de
   * `content_config.contactPage`, que es clave HERMANA de `contact` porque la
   * pantalla del footer reconstruye `contact` entero y se lo habría comido.
   *
   * `trim() || undefined` en cada uno por el mismo motivo que la descripción del
   * footer: un texto en blanco es "no lo configuré", no "borrame el default", y
   * emitirlo dejaría la tarjeta con el título vacío.
   */
  const pageCopy = content.contactPage ?? {};
  const pageTitle = pageCopy.title?.trim() || undefined;
  const pageDescription = pageCopy.description?.trim() || undefined;
  const pageNote = pageCopy.note?.trim() || undefined;
  if (pageTitle) contactPage.title = pageTitle;
  if (pageDescription) contactPage.description = pageDescription;
  if (pageNote) contactPage.note = pageNote;
  // Overlay the per-demo content config onto the template assets. `sections`
  // becomes `sectionVisibility`; the rest pass through by key. Only defined
  // values are set so the storefront keeps its own defaults when absent.
  const assets: Record<string, unknown> = {
    ...templateAssets,
    ...(content.sections ? { sectionVisibility: content.sections } : {}),
    ...(content.blogSectionName ? { blogSectionName: content.blogSectionName } : {}),
    ...(content.categoriesMenuLayout ? { categoriesMenuLayout: content.categoriesMenuLayout } : {}),
    // Orden del lugar flexible de la barra inferior mobile. Se emite sólo si la
    // lista tiene algo: `mobileNav: []` GANA ENTERA sobre el default del
    // storefront (el merge de `assets` es shallow por clave) y volvería a dejar
    // la barra en 4 columnas — justo lo que este campo arregla.
    ...(content.mobileNav?.length ? { mobileNav: content.mobileNav } : {}),
    // Ícono o texto por entrada de la barra. Mismo criterio: sólo si hay algo
    // que decir — la clave presente gana entera, y el storefront ya completa
    // con `icon` lo que no venga.
    ...(content.mobileNavDisplay && Object.keys(content.mobileNavDisplay).length
      ? { mobileNavDisplay: content.mobileNavDisplay }
      : {}),
    ...(content.sucursales ? { sucursales: content.sucursales } : {}),
    ...(content.shoppingList ? { shoppingList: content.shoppingList } : {}),
    ...(content.searchSuggestions ? { searchSuggestions: content.searchSuggestions } : {}),
    ...(content.searchHints ? { searchHints: content.searchHints } : {}),
    ...(content.brandsLayout ? { brandsLayout: content.brandsLayout } : {}),
    // Cart drawer toggles. Sólo se emite cuando el operador cargó al menos un
    // sub-campo: presente, la clave GANA ENTERA sobre `defaultConfig.assets.cart`
    // (el merge de assets es shallow por clave), así que emitirla vacía le
    // borraría defaults al storefront.
    ...(content.cart && Object.keys(content.cart).length
      ? { cart: content.cart }
      : {}),
    // Footer: todo lo que el backoffice edita (descripción, redes, legales,
    // newsletter, copyright) más el contacto, mergeado
    // sobre el footer del template (que aporta su propio copy por defecto).
    //
    // ⚠ La clave `footer` sólo se emite si hay algo que decir. Presente, GANA
    // ENTERA sobre `defaultConfig.assets.footer` del storefront (el merge de
    // assets es shallow POR CLAVE), así que emitirla vacía le borraría al sitio
    // el newsletter, los legales y el contacto. Para la principal
    // `templateAssets.footer` no existe, y ahí el que repone el resto es el
    // merge profundo de `mergeMainTenant` en el storefront.
    //
    // Y por eso cada sub-clave se emite SÓLO si tiene contenido: el formulario
    // del backoffice manda el footer completo, pero un array vacío o una cadena
    // en blanco significan "no lo configuré", no "borrámelo". Emitir
    // `legal: []` apagaría los legales del sitio sin que nadie lo haya pedido.
    ...(hasFooter
      ? {
          footer: {
            ...((templateAssets.footer as Record<string, unknown>) ?? {}),
            ...(footerDescription ? { description: footerDescription } : {}),
            ...(hasContact ? { contact: footerContact } : {}),
            ...(footerSocial ? { social: footerSocial } : {}),
            ...(footerLegal ? { legal: footerLegal } : {}),
            ...(footerNewsletter ? { newsletter: footerNewsletter } : {}),
            ...(footerCopyright ? { copyright: footerCopyright } : {}),
          },
        }
      : {}),
    /**
     * ⚠ El gate es `contactPage` NO VACÍO, no `hasContact`. Antes colgaba de
     * `hasContact` (teléfono/mail/dirección/horario), y con el copy editable eso
     * dejaba afuera a quien configurara SÓLO el título o sólo el párrafo: se
     * guardaba en la fila y no llegaba nunca al storefront.
     *
     * Presente, la clave GANA ENTERA sobre `defaultConfig.assets.contactPage`
     * (el merge de assets es shallow POR CLAVE), así que emitirla vacía sería
     * peor que no emitirla. Por eso cada sub-clave entra sólo si tiene contenido.
     */
    ...(Object.keys(contactPage).length
      ? {
          contactPage: {
            ...((templateAssets.contactPage as Record<string, unknown>) ?? {}),
            ...contactPage,
          },
        }
      : {}),
    // Puck home layout: when the demo has a customized home, expose it so the
    // storefront renders the demo home from it (see HomeRenderer). Absent =
    // storefront keeps the hardcoded per-template home.
    ...(demo.home_puck_data ? { homeLayout: demo.home_puck_data } : {}),
    /**
     * Content del template Campaña. Los defaults viven en el storefront
     * (`campaignConfig`) porque no dependen del ERP ni de la marca; acá sólo
     * pasan overrides. El merge del storefront (`overlayCampaign` en
     * `active-tenant.ts`) hace shallow POR SUB-CLAVE (`hero`, `chrome`, …), así
     * que un `hero: { title: 'X' }` parcial NO borra el resto del hero.
     *
     * `cleanCampaignOverride` strippea strings vacíos que el form manda cuando
     * el operador vacía un input (para que la sub-clave DESAPAREZCA y vuelva al
     * default del código, en vez de pisar el default con `""`).
     *
     * `footer` del vertical se ARMA acá desde las fuentes compartidas
     * (`content.contact` para email/phone/address; `content.footer` para
     * description/copyright) y se mergea con lo que el operador cargó en
     * `content.campaign.footer` (que hoy sólo aporta `poweredBy` y
     * `backgroundColor`, propios del template). Antes esas 4 propiedades vivían
     * duplicadas en `content.campaign.footer` — un 3er lugar de edición que
     * pisaba a los otros dos.
     *
     * Sólo se emite cuando `template_code === 'campaign'`: los demás templates
     * no leen `assets.campaign` y publicarlo sería ruido en el payload público.
     */
    ...(template.tenant_template === 'campaign'
      ? (() => {
          const cleanedCampaign = content.campaign
            ? (cleanCampaignOverride(content.campaign) as
                | Record<string, unknown>
                | undefined)
            : undefined;
          const campaignFooterOverride =
            (cleanedCampaign?.footer as Record<string, unknown> | undefined) ?? {};
          const email = contact.email?.trim() || undefined;
          const phone = contact.phone?.trim() || undefined;
          const address = contact.address?.trim() || undefined;
          const description = footerDescription;
          const copyright = footerCopyright;
          const footer: Record<string, unknown> = { ...campaignFooterOverride };
          if (email) footer.email = email;
          if (phone) footer.phone = phone;
          if (address) footer.address = address;
          if (description) footer.description = description;
          if (copyright) footer.copyright = copyright;
          const campaign: Record<string, unknown> = { ...(cleanedCampaign ?? {}) };
          if (Object.keys(footer).length) {
            campaign.footer = footer;
          } else {
            delete campaign.footer;
          }
          return Object.keys(campaign).length ? { campaign } : {};
        })()
      : {}),
    // MercadoPago: which checkout(s) to show + the public key the embedded
    // Payment Brick needs, resolved per sales channel from MERCADOPAGO_ACCOUNTS.
    mercadopago: buildMercadoPagoAssets(demo, content),
  };
  return {
    id: demo.id,
    domains: [],
    // Forma canónica para SEO. Se publica acá para que el storefront la lea del
    // tenant que YA tiene cargado, sin una consulta extra — y sobre todo sin que el
    // proxy tenga que leer la fila, que rompería el cero-I/O del camino caliente.
    canonicalForm: demo.canonical_form ?? 'host',
    name: demo.name,
    template: template.tenant_template,
    vertical: template.vertical,
    medusa: {
      salesChannelId: demo.sales_channel_id ?? '',
      ...(demo.b2b_enabled && demo.b2b_sales_channel_id
        ? {
            b2b: {
              enabled: true,
              salesChannelId: demo.b2b_sales_channel_id,
              tiers: demo.b2b_pricing_tiers ?? WHOLESALE_TIERS.map((t) => ({ ...t })),
            },
          }
        : {}),
      ...(demo.recurring_enabled ? { recurring: { enabled: true } } : {}),
      ...(demo.tinting_enabled ? { tinting: { enabled: true } } : {}),
      // Mi cuenta. Estas DOS se publican SIEMPRE, con el booleano explícito, y no
      // con el `...(x ? {} : {})` del resto: el default es `true`, así que la
      // ausencia de la clave tiene que leerse como "visible" (storefront nuevo
      // contra backend viejo). De ahí el `!== false` en vez de `!!`.
      loyalty: { enabled: demo.loyalty_enabled !== false },
      giftCards: { enabled: demo.gift_cards_enabled !== false },
      // Página de contraseña: se publica SÓLO si está prendida y con clave, y
      // únicamente `enabled` + `length` (cuántas casillas dibujar). Este payload
      // es PÚBLICO: agregar la palabra acá la filtraría a cualquiera que pegue
      // GET /store/demo-stores/{slug}/config.
      ...(demo.password_gate_enabled && demo.password_gate_password
        ? {
            passwordGate: {
              enabled: true,
              length: demo.password_gate_password.length,
            },
          }
        : {}),
    },
    theme: {
      colors: {
        primary: theme.primary_color || '#2e7d32',
        secondary: theme.secondary_color || undefined,
        accent: theme.accent_color || undefined,
        // Fondos del chrome: ausentes = el storefront usa el default del template.
        headerBackground: theme.header_background || undefined,
        footerBackground: theme.footer_background || undefined,
        // Boton "Promociones" del header: ausente = el storefront usa el primario.
        promoButton: theme.promo_button_color || undefined,
      },
      typography: theme.typography ? { fontFamily: theme.typography } : undefined,
    },
    assets,
    metadata: {
      name: demo.name,
      // NO decir "demo": este campo alimenta el `<meta name="description">` y la
      // social card (OG image) del sitio público de un cliente. El default se
      // eligió para que la fila principal produzca exactamente
      // `"Tienda online de Mercatto"`, byte-idéntico a
      // `defaultConfig.metadata.description` en el storefront.
      description: content.description || `Tienda online de ${demo.name}`,
      ...(contact.email || contact.phone
        ? { contact: { email: contact.email, phone: contact.phone } }
        : {}),
    },
  };
}
