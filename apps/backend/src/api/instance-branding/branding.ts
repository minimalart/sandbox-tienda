/**
 * La marca de ESTA instalación, para que el operador sepa en qué backend está.
 *
 * Módulo PURO a propósito: sin contenedor, sin `req`. El adaptador que lee la base
 * vive en `route.ts`. La parte riesgosa no es la lectura, es el FILTRO de abajo.
 */

/** El `theme` de la fila de tienda, tal cual sale de la columna JSON. */
export type ThemeLike = Record<string, unknown> | null | undefined;

export type InstanceBranding = {
  /** Nombre del Store de Medusa — el mismo que el sidebar del admin ya muestra. */
  name: string | null;
  /** Logo horizontal. Lo usan la barra superior y el login. */
  logo: string | null;
  /** Isotipo cuadrado. Es el que sirve de favicon; el logo horizontal no. */
  icon: string | null;
  /** Favicon explícito, si la marca cargó uno. */
  favicon: string | null;
  /** Color primario, para el acento de la píldora. */
  color: string | null;
};

export const EMPTY_INSTANCE_BRANDING: InstanceBranding = {
  name: null,
  logo: null,
  icon: null,
  favicon: null,
  color: null,
};

const trimToNull = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
};

/**
 * Sólo URLs ABSOLUTAS (o `data:`). Un path relativo se DESCARTA.
 *
 * `theme.logo` puede venir de dos lugares y sólo uno sirve acá:
 *
 *  - subido desde el admin -> URL absoluta de S3. Sirve.
 *  - semilla del template -> path relativo a la raíz (`/logos-mercatto/...`,
 *    `/logo_full.webp`), que existe en el `public/` del STOREFRONT. El admin se
 *    sirve desde el origen del BACKEND, donde ese path es un 404: la barra
 *    mostraría el ícono de imagen rota en toda instalación que no subió logo
 *    propio — o sea en la mayoría.
 *
 * Resolverlo pediría la base pública del storefront, y pre-login no está: la ruta
 * que la expone (`/admin/store-config/storefront-url`) es autenticada y de una
 * extensión opcional (ver `admin/hooks/use-storefront-base.ts`). Así que se
 * descarta y el widget cae a su propio fallback, que siempre se ve bien.
 */
const absoluteAssetOrNull = (v: unknown): string | null => {
  const s = trimToNull(v);
  if (!s) return null;
  return /^(https?:\/\/|data:)/i.test(s) ? s : null;
};

/**
 * Sólo hex. El color termina en un `style` inline del widget, así que lo que no
 * valide no se emite: una cadena arbitraria de la base no tiene por qué llegar a
 * un atributo de estilo.
 */
const hexColorOrNull = (v: unknown): string | null => {
  const s = trimToNull(v);
  if (!s) return null;
  return /^#[0-9a-f]{3,8}$/i.test(s) ? s : null;
};

/**
 * `storeName` sale del Store de Medusa (core, siempre existe) y `theme` de la fila
 * principal de `demo_store` (extensión opcional). Con `theme` nulo el resultado
 * sigue siendo útil: nombre solo, que es más de lo que hay hoy.
 */
export function buildInstanceBranding(storeName: unknown, theme: ThemeLike): InstanceBranding {
  const t = (theme && typeof theme === 'object' ? theme : {}) as Record<string, unknown>;
  return {
    name: trimToNull(storeName),
    logo: absoluteAssetOrNull(t.logo),
    // `mobile_logo` es el nombre viejo de `icon`; se lee de fallback igual que en
    // `modules/demo-store/templates/shared.ts`.
    icon: absoluteAssetOrNull(t.icon) ?? absoluteAssetOrNull(t.mobile_logo),
    favicon: absoluteAssetOrNull(t.favicon),
    color: hexColorOrNull(t.primary_color),
  };
}

/** Color del cuadradito cuando la instalación no cargó `primary_color`. */
export const FALLBACK_BRAND_COLOR = '#3b82f6';

export const colorOf = (branding: Pick<InstanceBranding, 'color'>): string =>
  branding.color ?? FALLBACK_BRAND_COLOR;

/** La inicial que va en el cuadradito, ya en mayúscula. */
export function initialOf(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?';
}

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Favicon generado: cuadrado del color de la marca con la inicial.
 *
 * Para que TODA instalación tenga una pestaña distinguible sin que nadie suba nada.
 * Es el reemplazo del logo de Mercatto que `/favicon.ico` servía hardcodeado: un
 * favicon ajeno se ve bien y por eso no se reporta, que es justo lo que lo volvía
 * duradero.
 *
 * Vive del lado del SERVIDOR y no en el admin a propósito. `/favicon.ico` ya tiene
 * que resolver la prioridad (favicon explícito -> isotipo -> generado), así que el
 * admin apunta el `<link rel="icon">` ahí y no reimplementa nada: una sola
 * implementación, sin dos copias del mismo SVG que puedan divergir.
 */
export function buildInitialFaviconSvg(name: string | null | undefined, color: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">` +
    `<rect width="64" height="64" rx="14" fill="${escapeXml(color)}"/>` +
    `<text x="32" y="45" text-anchor="middle" fill="#ffffff" ` +
    `font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="38" font-weight="600">` +
    `${escapeXml(initialOf(name))}</text></svg>`
  );
}

/**
 * Lo que sale por la API: igual que `InstanceBranding` pero con `color` e `initial`
 * ya RESUELTOS.
 *
 * Los resuelve el servidor y no el admin para que haya UNA sola implementación. Son
 * los dos datos que dibujan el cuadradito de la barra y, cuando no hay asset, también
 * el favicon generado: si el admin trajera su propio fallback de color o su propia
 * forma de sacar la inicial, la pestaña y la barra podrían terminar mostrando cosas
 * distintas, y la divergencia no rompe nada — sólo se ve mal, que es como sobreviven
 * estos bugs.
 */
export type InstanceBrandingPayload = Omit<InstanceBranding, 'color'> & {
  color: string;
  initial: string;
};

export function toInstanceBrandingPayload(branding: InstanceBranding): InstanceBrandingPayload {
  return {
    ...branding,
    color: colorOf(branding),
    initial: initialOf(branding.name),
  };
}
