/**
 * Open Graph / Twitter Cards del sitio: lo que se ve cuando alguien pega un link
 * de la tienda en WhatsApp, Instagram, Slack o X.
 *
 * Vive en su propio archivo y sin una sola importación a propósito: lo consume
 * `config.ts` (que arrastra el módulo store-config y con él medio framework) y lo
 * consume su test. Sacar la normalización de ahí es lo que la vuelve verificable.
 *
 * TODO CAMPO VACÍO SIGNIFICA "usá el default del storefront". No se guardan los
 * valores efectivos: si mañana cambia el nombre de la tienda, una card configurada
 * en blanco lo sigue; una configurada con el nombre viejo, no. Por eso la cadena
 * vacía es un valor legítimo y no un "sin configurar" que haya que completar.
 */

/** Formato de la card de Twitter/X. Son los dos únicos que sirven para una tienda. */
export const TWITTER_CARDS = ['summary_large_image', 'summary'] as const;

export type TwitterCard = (typeof TWITTER_CARDS)[number];

export type OpenGraphConfig = {
  /** `og:site_name`. Vacío = el nombre de la tienda. */
  site_name: string;
  /** `og:title`. Vacío = el title de la página. */
  title: string;
  /** `og:description`. Vacío = la description de la página. */
  description: string;
  /**
   * `og:image`. Vacío = la tarjeta 1200x630 que el storefront genera con el nombre
   * y el color de la tienda (`app/opengraph-image.tsx`), que es un default digno.
   */
  image_url: string;
  /** Texto alternativo de la imagen. Vacío = el nombre de la tienda. */
  image_alt: string;
  /** `og:locale`. */
  locale: string;
  twitter_card: TwitterCard;
  /** Cuenta de X (`@tienda`). Vacío = no se emite `twitter:site`. */
  twitter_site: string;
};

export const OPEN_GRAPH_DEFAULTS: OpenGraphConfig = {
  site_name: '',
  title: '',
  description: '',
  image_url: '',
  image_alt: '',
  locale: 'es_AR',
  twitter_card: 'summary_large_image',
  twitter_site: '',
};

/**
 * Normaliza lo que venga de la base o del body del admin.
 *
 * Los strings se recortan porque un espacio en blanco NO es un valor: emitiría
 * `og:title=" "` y las redes lo muestran vacío en vez de caer al default. `locale`
 * y `twitter_card` caen al default cuando no reconocen el valor, por la misma
 * razón por la que existe este archivo: la card la ve el cliente, no el operador.
 */
export function normalizeOpenGraph(value: unknown): OpenGraphConfig {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof OpenGraphConfig, unknown>>;
  const str = (key: keyof OpenGraphConfig): string =>
    typeof v[key] === 'string' ? (v[key] as string).trim() : OPEN_GRAPH_DEFAULTS[key as 'site_name'];

  const locale = str('locale');
  const card = typeof v.twitter_card === 'string' ? v.twitter_card.trim() : '';
  const handle = str('twitter_site');

  return {
    site_name: str('site_name'),
    title: str('title'),
    description: str('description'),
    // Sólo http(s) y sin `javascript:` ni `data:`: este valor termina en un atributo
    // de una etiqueta que sirve cualquier red social, no sólo el navegador propio.
    image_url: isHttpUrl(str('image_url')) ? str('image_url') : '',
    image_alt: str('image_alt'),
    locale: locale || OPEN_GRAPH_DEFAULTS.locale,
    twitter_card: (TWITTER_CARDS as readonly string[]).includes(card)
      ? (card as TwitterCard)
      : OPEN_GRAPH_DEFAULTS.twitter_card,
    // La arroba se normaliza en vez de exigirse: el operador la escribe o no, y
    // `twitter:site` sin ella no matchea ninguna cuenta.
    twitter_site: handle ? (handle.startsWith('@') ? handle : `@${handle}`) : '',
  };
}

function isHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
