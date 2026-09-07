import type { DemoStoreStatus } from '../../hooks/api';

const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;

/**
 * NO HAY BASE DEL STOREFRONT EN ESTE ARCHIVO, Y ES A PROPÓSITO.
 *
 * Acá vivía `DEMO_STOREFRONT_BASE_URL`, que la resolvía en BUILD: primero
 * `window.__MERCATTO_STOREFRONT_URL__` —que no lo seteaba nadie en todo el repo—,
 * después `VITE_STOREFRONT_URL` —que el Dockerfile de despliegue no recibe como
 * build arg— y al final un literal con el dominio de una instalación concreta. O
 * sea: en cualquier instalación real ganaba SIEMPRE el literal, y el listado de
 * tiendas de una marca linkeaba al storefront de otra. Se parcheó dos veces
 * cambiando el literal en el repo del cliente y el sync del template lo revirtió
 * las dos, porque el literal es del template y el dominio es del cliente.
 *
 * La base es un dato de RUNTIME: la sirve `GET /admin/store-config/storefront-url`
 * y la consume `useStorefrontBase()`. Las funciones de este archivo la reciben por
 * parámetro y son puras — por eso se pueden testear sin tocar el entorno de Vite.
 */

/**
 * Prefijo público de una tienda en su forma de RUTA.
 *
 * `tiendas`, no `demo`: el proxy sirve `/tienda/<slug>` y hace 308 permanente
 * desde `/demo/<slug>` (`proxy.ts:266`). Con el literal viejo, cada link del admin
 * se comía un redirect antes de llegar.
 */
export const SITE_PATH_PREFIX = 'tienda';

/**
 * Sufijo del wildcard de subdominios, p. ej. `.mercatto.ar`.
 *
 * TIENE QUE COINCIDIR con `NEXT_PUBLIC_SITE_HOST_SUFFIX` del storefront, que es
 * quien realmente resuelve el host. Son dos artefactos de build distintos y nada
 * los cruza: si difieren, el admin linkea a un host que no existe.
 *
 * Vacío por default a propósito. Sin wildcard configurado el subdominio NO resuelve,
 * así que mostrar `moda.mercatto.ar` sería un link muerto: se cae a la forma de ruta,
 * que siempre funciona. Misma disciplina que el resto del bloque de host — todo
 * camino nuevo es no-op mientras la variable esté vacía.
 */
export const SITE_HOST_SUFFIX: string = viteEnv?.VITE_SITE_HOST_SUFFIX?.trim() ?? '';

type SiteUrlRow = {
  slug: string;
  is_main?: boolean | null;
  /** Cuál de las dos formas es la canónica. Las DOS resuelven siempre. */
  canonical_form?: 'host' | 'path' | null;
};

type SiteUrlOptions = { baseUrl: string; hostSuffix: string };

/** `mercatto.ar` y `.mercatto.ar` son lo mismo para esto. */
const normalizeSuffix = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
};

const withoutTrailingSlash = (raw: string): string => raw.replace(/\/+$/, '');

/**
 * `host` es el default, igual que en `templates/index.ts` y en el form de edición:
 * la columna se creó con `default 'host'`, así que una fila sin el campo (payload
 * viejo) tiene que leerse como subdominio y no caerse a ruta en silencio.
 */
const canonicalFormOf = (site: SiteUrlRow): 'host' | 'path' => site.canonical_form ?? 'host';

/** Si esta fila se sirve por subdominio con la config actual. */
const usesHostForm = (site: SiteUrlRow, hostSuffix: string): boolean =>
  !site.is_main && canonicalFormOf(site) === 'host' && normalizeSuffix(hostSuffix) !== '';

/**
 * URL pública de una tienda, respetando su `canonical_form`. Núcleo PURO: recibe la
 * base y el sufijo, así se puede testear sin tocar el entorno de Vite.
 *
 * Protocolo y puerto salen de la base, no se hardcodean: es lo que hace que en local
 * `http://localhost:3000` produzca `http://moda.localhost:3000`, que es la única
 * forma de ejercitar el camino de subdominio sin tocar `/etc/hosts`.
 */
export const buildPublicUrlFrom = (site: SiteUrlRow, options: SiteUrlOptions): string => {
  const base = withoutTrailingSlash(options.baseUrl);
  if (site.is_main) return base;

  if (usesHostForm(site, options.hostSuffix)) {
    const parsed = new URL(base);
    const port = parsed.port ? `:${parsed.port}` : '';
    return `${parsed.protocol}//${site.slug}${normalizeSuffix(options.hostSuffix)}${port}`;
  }


  return `${base}/${SITE_PATH_PREFIX}/${site.slug}`;
};

/**
 * Texto CORTO para mostrar en el listado. Separado del href porque son cosas
 * distintas: el href necesita el origen completo y la celda muestra sólo lo que
 * identifica a la tienda.
 */
export const formatPublicUrlFrom = (site: SiteUrlRow, options: SiteUrlOptions): string => {
  if (site.is_main) return '/';
  if (usesHostForm(site, options.hostSuffix)) {
    return new URL(buildPublicUrlFrom(site, options)).host;
  }
  return `/${SITE_PATH_PREFIX}/${site.slug}`;
};

/**
 * OJO: no hay `buildPublicUrl(site)` de un solo argumento.
 *
 * Existía, y leía la base de un módulo — que es exactamente cómo el bug del
 * dominio equivocado entró a un `href` sin que ningún call site lo mencione. La
 * base se pasa: `buildPublicUrlFrom(site, { baseUrl: useStorefrontBase(), hostSuffix: SITE_HOST_SUFFIX })`.
 */

/** ISO-2 country → ISO-4217 currency, for sensible currency defaults. */
const COUNTRY_CURRENCY: Record<string, string> = {
  ar: 'ars',
  br: 'brl',
  cl: 'clp',
  co: 'cop',
  mx: 'mxn',
  pe: 'pen',
  uy: 'uyu',
  us: 'usd',
  es: 'eur',
  fr: 'eur',
  de: 'eur',
  it: 'eur',
  pt: 'eur',
  nl: 'eur',
  gb: 'gbp',
};

export const currencyForCountry = (countryCode: string): string | null =>
  COUNTRY_CURRENCY[countryCode.trim().toLowerCase()] ?? null;

export const STATUS_COLOR: Record<DemoStoreStatus, 'green' | 'orange' | 'red' | 'grey' | 'blue'> = {
  draft: 'grey',
  provisioning: 'blue',
  importing: 'orange',
  ready: 'green',
  failed: 'red',
};

export const STATUS_LABEL_KEY: Record<DemoStoreStatus, string> = {
  draft: 'STATUS_DRAFT',
  provisioning: 'STATUS_PROVISIONING',
  importing: 'STATUS_IMPORTING',
  ready: 'STATUS_READY',
  failed: 'STATUS_FAILED',
};
