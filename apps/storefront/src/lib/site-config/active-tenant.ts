import { notFound } from "next/navigation";
import { enabledStoreB2B } from "./b2b-access";
import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getTenant } from "./resolver";
import { defaultConfig } from "./default";
import { technologyConfig } from "./technology";
import { fashionConfig } from "./fashion";
import { techRetailConfig } from "./tech-retail";
import { sportsConfig } from "./sports";
import { campaignConfig } from "./campaign";
import { mergeMainTenant } from "./main-tenant";
import type { CampaignHomeConfig, TenantConfig } from "./types";

/**
 * Overlay per-demo (`assets.campaign`) sobre los defaults del template Campaña
 * (`campaignConfig`), UNA capa: el spread nativo `{ ...campaignConfig, ...over }`
 * es shallow por clave de nivel 1, y con eso enviar `{ hero: { title: 'X' } }`
 * pisaba el hero ENTERO — borrándole al sitio eyebrow, subtitle, image, cta y
 * trustBadges y dejando el hero solo con `title`. Ahora mergeo sub-clave por
 * sub-clave así el override parcial que emite el backoffice pisa sólo lo que
 * el operador editó y el resto vuelve a los defaults del código.
 *
 * Los arrays (p.ej. `hero.trustBadges`) SÍ se pisan enteros — el operador que
 * edita la lista de badges quiere reemplazarla, no agregarle al final.
 */
type CampaignSlotKey = 'announcement' | 'chrome' | 'hero' | 'kits' | 'footer';
const CAMPAIGN_SLOTS: CampaignSlotKey[] = [
  'announcement',
  'chrome',
  'hero',
  'kits',
  'footer',
];
function overlayCampaign(
  base: CampaignHomeConfig,
  over: Partial<CampaignHomeConfig> | undefined,
): CampaignHomeConfig {
  if (!over) return base;
  const out: any = { ...base };
  for (const k of CAMPAIGN_SLOTS) {
    const overK = (over as any)[k];
    const baseK = (base as any)[k];
    if (
      overK &&
      typeof overK === 'object' &&
      !Array.isArray(overK) &&
      baseK &&
      typeof baseK === 'object'
    ) {
      out[k] = { ...baseK, ...overK };
    } else if (overK !== undefined) {
      out[k] = overK;
    }
  }
  return out;
}

/**
 * Server-only, request-aware tenant resolution for Demo Stores.
 *
 * The storefront is multi-tenant by path: /demo/{slug} pages resolve a demo's
 * branding + template + sales channel. The proxy injects an `x-demo-slug`
 * header on those requests; this module reads it and fetches the demo config
 * from the backend.
 *
 * IMPORTANT: kept SEPARATE from resolver.ts on purpose. resolver.getTenant()
 * must stay client-safe (config.ts → sdk is imported by a client component, see
 * memory storefront-gettenant-client-safe). This file is `server-only` and is
 * only imported by server components / server-only data modules.
 */
/**
 * Headers de identidad del sitio, emitidos por `proxy.ts`.
 *
 * Se lee el nuevo primero y el viejo como fallback DURANTE UN RELEASE. No hace falta
 * más que eso: el proxy y este archivo viajan en el mismo artefacto de build de Next
 * y Vercel sirve un deployment inmutable por request, así que emisor y lector nunca
 * pueden ser de versiones distintas. El fallback es sólo por si un deploy queda a
 * mitad de camino.
 */
const SITE_HEADER = "x-site-slug";
const DEMO_HEADER = "x-demo-slug";
/** Prefijo de path para armar links. `''` cuando el sitio se resolvió por host. */
const SITE_PREFIX_HEADER = "x-site-prefix";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";

/**
 * Fetch de la config de una tienda, con DOBLE LECTURA de la ruta.
 *
 * La ruta se renombró a `/store/sites/...`. La vieja se sigue intentando UN RELEASE
 * porque backend y storefront se despliegan por caminos independientes y sin orden
 * garantizado, así que el fallback tiene que cubrir las dos direcciones:
 *
 *  - storefront nuevo + backend viejo → `/store/sites/` da 404 → cae a la vieja ✔
 *  - backend nuevo + storefront viejo → el backend sirve las dos (re-export) ✔
 *
 * Sin esto, la ventana entre los dos deploys deja a TODAS las tiendas renderizando con
 * el branding por defecto del sitio principal.
 *
 * El orden importa: primero la nueva, para que el día que se borre la vieja no cambie
 * nada. BORRAR EL FALLBACK EN EL PR DE CLEANUP.
 */
const SITE_CONFIG_PATHS = ["sites", "demo-stores"] as const;

/**
 * QUIÉN firmó una respuesta que no fue OK.
 *
 * El status solo no alcanza cuando el mismo 403 puede venir de tres lugares y cada uno
 * se arregla en un panel distinto: un proxy que bloquea antes de llegar al backend (se
 * arregla en Cloudflare), el propio Medusa rechazando la request (se arregla en el
 * backend o en las envs), o la plataforma de hosting. Y el caso que motivó esto es
 * justamente indistinguible desde afuera: la MISMA URL con la MISMA key devuelve 200
 * desde una IP residencial y 403 desde las funciones de Vercel, así que reproducirlo a
 * mano no sirve — el dato sólo existe del lado del server que recibe el rechazo.
 *
 * Dos señales bastan para desempatar:
 *   - `cf-ray` presente  → contestó Cloudflare, el backend nunca vio la request.
 *   - el body: HTML      → página de bloqueo de un proxy.
 *     el body: JSON con `type`/`message` → contestó Medusa.
 *
 * Se trunca a 200 caracteres y se colapsan los saltos de línea para que siga siendo UNA
 * línea de log. La key nunca aparece en estos bodies, así que no hay nada que ocultar.
 */
const describeRejection = async (res: Response): Promise<string> => {
  const ray = res.headers.get("cf-ray");
  const server = res.headers.get("server");
  const via = ray
    ? `cf-ray=${ray}`
    : server
      ? `server=${server}`
      : "sin cabecera de proxy";
  let body: string;
  try {
    body = (await res.text()).replace(/\s+/g, " ").trim().slice(0, 200);
  } catch {
    // Un body ilegible no puede tapar el status, que es el dato principal.
    body = "(body ilegible)";
  }
  return `[${via}] ${body}`;
};

export async function fetchSiteConfig<T = { config: TenantConfig }>(
  path: string,
  tag: string,
  fresh = false,
): Promise<T | null> {
  const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  /**
   * Motivo de fallo por ruta intentada, para el log del final.
   *
   * El fallback a `defaultConfig` es DELIBERADO y no cambia (ver `getMainTenant`), pero
   * hasta acá era además INVISIBLE: una publishable key de otra instancia, un
   * `NEXT_PUBLIC_MEDUSA_BACKEND_URL` mal apuntado y un backend caído producían los tres
   * el mismo síntoma —el sitio renderiza con los colores por defecto y no vuelve a
   * cambiar nunca— sin una sola línea en los logs. El equipo perdió una tarde en un
   * proyecto nuevo persiguiendo eso creyendo que era la DB. Loguear no arregla el
   * fallo: lo vuelve diagnosticable en un `curl`.
   */
  const failures: string[] = [];
  for (const segment of SITE_CONFIG_PATHS) {
    const url = `${BACKEND_URL}/store/${segment}${path ? `/${path}` : ""}`;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(pk ? { "x-publishable-api-key": pk } : {}),
        },
        ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 60, tags: [tag] } }),
      });
      if (res.ok) return (await res.json()) as T;
      // 404 en la ruta nueva = backend viejo: se prueba la legacy. Cualquier otro
      // status tampoco corta el loop: un 500 transitorio en una no implica en la otra.
      failures.push(`${url} → ${res.status} ${await describeRejection(res)}`);
    } catch (err) {
      // red caída o backend abajo: se prueba la siguiente
      failures.push(`${url} → ${(err as Error)?.message ?? String(err)}`);
    }
  }
  /**
   * Una sola línea, recién cuando fallaron TODAS las rutas. Un 404 en la ruta nueva con
   * la legacy respondiendo es el camino feliz del release escalonado y no tiene que
   * ensuciar los logs.
   *
   * La key NO se imprime, sólo si estaba presente: es el dato que distingue "falta la
   * env" de "la env es de otra instancia", que son los dos fallos reales, y alcanza.
   */
  console.error(
    `[site-config] Sin config para "${path}": se cae a defaultConfig y el sitio ` +
      `ignora lo que se edite en el admin. publishable key ${pk ? "presente" : "AUSENTE"}. ` +
      `Intentos: ${failures.join(" | ")}`,
  );
  return null;
}

/** Fetch a site's storefront config by slug. Returns null if not ready/found. */
export const getTenantBySlug = cache(
  async (slug: string): Promise<TenantConfig | null> => {
    try {
      const data = await fetchSiteConfig(`${slug}/config`, `site-${slug}`);
      const demo = data?.config;
      if (!demo) return null;
      // Inherit the default supermarket content sections (collections,
      // moreProducts, resellerKits, shoppableVideos, …) so the demo home shows
      // the same sections as the main home; the demo overrides branding + hero
      // per-key (logos, colors, heroBanners, featuredProducts, footer, topbar).
      //
      // Vertical templates (technology / fashion / tech-retail / sports) render
      // their dedicated home + chrome (modules/home-*). Their content lives
      // under `assets.technology` / `assets.fashion` / `assets.techRetail` /
      // `assets.sports`; we merge the default content per template as a fallback
      // so a demo that only sets branding still has a full home (header nav,
      // hero, sections and footer) instead of an empty body. Other templates
      // ignore these keys entirely.
      return {
        ...demo,
        assets: {
          ...defaultConfig.assets,
          ...(demo.assets ?? {}),
          technology: {
            ...technologyConfig,
            ...(demo.assets?.technology ?? {}),
          },
          fashion: {
            ...fashionConfig,
            ...(demo.assets?.fashion ?? {}),
          },
          techRetail: {
            ...techRetailConfig,
            ...(demo.assets?.techRetail ?? {}),
          },
          sports: {
            ...sportsConfig,
            ...(demo.assets?.sports ?? {}),
          },
          campaign: overlayCampaign(campaignConfig, demo.assets?.campaign),
        },
      };
    } catch {
      return null;
    }
  },
);

/**
 * El slug del sitio activo, o null si es el sitio principal.
 *
 * ES EL ÚNICO LECTOR DEL HEADER EN TODO EL REPO, y sus 18 consumidores heredan
 * cualquier cambio gratis. Por eso la Fase 6 (resolución por host) sólo tiene que
 * agregarle un fallback por `Host` acá para que TAMBIÉN funcionen las rutas que el
 * matcher del proxy excluye (`robots`, `sitemap`, `llms.txt`, las OG images), que
 * nunca reciben el header.
 *
 * Llamarla vuelve DINÁMICA la request — y ese efecto secundario es, hoy, lo que
 * mantiene todo el aislamiento entre tiendas (ver `cache-directives.test.ts`).
 */
export const getActiveSiteSlug = cache(async (): Promise<string | null> => {
  try {
    const h = await headers();
    const fromHeader = h.get(SITE_HEADER) || h.get(DEMO_HEADER);
    if (fromHeader) return fromHeader;

    /**
     * Fallback por HOST — y es la línea que hace funcionar toda la Fase 7.
     *
     * El matcher del proxy EXCLUYE `sitemap.xml`, `robots.txt`, `llms.txt`,
     * `opengraph-image` y `twitter-image`, así que esas rutas **nunca reciben el
     * header**. Sin esto, cada una serviría el contenido del sitio principal en el
     * host de cualquier tienda: el sitemap de A en el dominio de B.
     *
     * Con el fallback acá, resuelven el tenant correcto SIN cambiar una línea de su
     * lógica de tenant — sólo hay que quitarles el `revalidate`. El header sigue
     * siendo la vía rápida para el árbol de `[countryCode]`, que sí lo recibe y así
     * evita re-normalizar el host en cada llamada.
     *
     * No-op mientras no haya multi-host: `resolveHostSlug` devuelve `null` sin
     * `NEXT_PUBLIC_SITE_HOST_SUFFIX`.
     */
    if (!process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX) return null;
    const { readHostSlugFromHeaders } = await import("./host-slug");
    return readHostSlugFromHeaders(h);
  } catch {
    return null;
  }
});

/**
 * Prefijo de path del sitio activo (`/tienda/moda`), o `''`.
 *
 * Vale `''` cuando el sitio se resolvió por HOST: ahí el host ya identifica el sitio
 * y los links no llevan prefijo. Es el mecanismo por el que los ~34 call sites de
 * `withSitePrefix()` se vuelven no-op solos cuando se prenden los subdominios.
 */
export const getActiveSitePrefix = cache(async (): Promise<string> => {
  try {
    const h = await headers();
    return h.get(SITE_PREFIX_HEADER) ?? "";
  } catch {
    return "";
  }
});

/**
 * @deprecated Usar `getActiveSiteSlug`. Se mantiene un release porque tiene 18 call
 * sites; el PR de cleanup los renombra y borra este alias.
 */
export const getActiveDemoSlug = getActiveSiteSlug;

/**
 * Config de la tienda PRINCIPAL, mergeada SOBRE `defaultConfig`.
 *
 * `defaultConfig` no se borra nunca: sigue siendo el baseline (y `getTenant()` tiene
 * que seguir siendo client-safe, así que no puede fetchear). La fila es una capa de
 * override encima. Toda la lógica de merge — con sus dos trampas — vive en el módulo
 * PURO `main-tenant.ts`, que es lo que testea `main-tenant.test.ts`.
 */
export const getMainTenant = cache(async (): Promise<TenantConfig | null> => {
  try {
    // Misma doble lectura de ruta que `getTenantBySlug` (ver `fetchSiteConfig`).
    // Null = la fila todavía no existe, o el backend es más viejo que este deploy: se
    // cae a `defaultConfig`, que es el comportamiento previo a esta fase.
    const data = await fetchSiteConfig("main/config", "site-main");
    if (!data?.config) return null;
    return mergeMainTenant(defaultConfig, data.config);
  } catch {
    return null;
  }
});

/**
 * The tenant for the current request: the demo tenant when on a /demo/{slug}
 * page, otherwise the default tenant. Drop-in replacement for getTenant() in
 * server components that drive branding/content.
 */
export const getActiveTenant = cache(async (): Promise<TenantConfig> => {
  const slug = await getActiveDemoSlug();
  if (slug) {
    const demo = await getTenantBySlug(slug);
    if (demo) return demo;
    notFound();
  }
  // Sin slug = el sitio principal, que ahora también es una fila gestionable desde
  // el admin. Si la fila no está (backend viejo, o no se pudo sembrar), se cae a
  // `defaultConfig` vía `getTenant()`: exactamente el comportamiento anterior.
  const main = await getMainTenant();
  if (main) return main;
  return getTenant();
});

/**
 * The demo's sales channel id for the current request, or undefined when not on
 * a demo page. Lets getActiveSalesChannelId() scope catalog to the demo.
 */
export const getActiveDemoSalesChannelId = cache(
  async (): Promise<string | undefined> => {
    const slug = await getActiveDemoSlug();
    if (!slug) return undefined;
    const demo = await getTenantBySlug(slug);
    if (!demo) notFound();
    return demo.medusa.salesChannelId || undefined;
  },
);

/**
 * The active demo's B2B / wholesale config for the current request, when the
 * demo has B2B enabled. Used by the B2B cart to scope the wholesale channel to
 * the demo, and by the order builder to show/apply the quantity tiers.
 */
export const getActiveDemoB2B = cache(
  async (): Promise<
    { salesChannelId: string; tiers?: { minQty: number; discount: number }[] } | undefined
  > => {
    const slug = await getActiveDemoSlug();
    // Read the explicit store record on each request so disabling B2B takes effect
    // immediately and missing child config cannot inherit main-store defaults.
    const data = await fetchSiteConfig(
      slug ? `${slug}/config` : "main/config",
      slug ? `site-${slug}` : "site-main",
      true,
    );
    return enabledStoreB2B(data?.config);
  },
);

/** The active demo's wholesale sales channel id, or undefined when not applicable. */
export const getActiveDemoB2BSalesChannelId = cache(
  async (): Promise<string | undefined> => (await getActiveDemoB2B())?.salesChannelId,
);

/**
 * Whether recurring purchases (compras recurrentes) are enabled for the current
 * request: the site row's `recurring_enabled` toggle (surfaced as
 * `medusa.recurring.enabled`), for demos AND for the main store.
 *
 * REGLA UNICA PARA TODAS LAS TIENDAS, principal incluida (mismo criterio que
 * `tinting-gate.ts`). Antes la principal se saltaba la fila y miraba solo
 * `NEXT_PUBLIC_RECURRING_ENABLED`, asi que el toggle "Compras recurrentes" de
 * /app/sites para la tienda principal no estaba cableado a nada: apagarlo en el
 * admin dejaba el boton "Suscribirse" en la PDP, el badge en las cards y la
 * seccion de cuenta exactamente igual.
 *
 * Si la fila principal NO se pudo leer (backend viejo, fila sin sembrar) se cae
 * al env, que es el comportamiento anterior: ahi no hay ningun lugar donde
 * prender el toggle y apagar la feature seria quitarla a cambio de nada. El
 * backend aplica la misma regla al crear (`isRecurringEnabledForChannel`), asi
 * que esto solo decide visibilidad.
 */
export const getRecurringEnabled = cache(async (): Promise<boolean> => {
  const slug = await getActiveDemoSlug();
  if (slug) {
    const demo = await getTenantBySlug(slug);
    return Boolean(demo?.medusa.recurring?.enabled);
  }
  const main = await getMainTenant();
  if (main) return Boolean(main.medusa.recurring?.enabled);
  return process.env.NEXT_PUBLIC_RECURRING_ENABLED !== "false";
});

/**
 * Si la sección "Mis puntos" (fidelización) se muestra en esta tienda.
 *
 * OPT-OUT, al revés de `getRecurringEnabled`: la clave ausente vale VISIBLE. La
 * sección hoy está hardcodeada en el nav de la cuenta, así que el gate sólo puede
 * SACAR algo que ya está: si la fila no trae la clave (backend viejo, fila sin
 * sembrar) tiene que quedar como estaba. De ahí el `!== false` en vez de
 * `Boolean(...)` — y de ahí que el fallback final, cuando no se pudo leer NINGUNA
 * fila, sea `true` y no un env: un hipo del backend no puede apagarle la sección a
 * todas las tiendas.
 */
export const getLoyaltyEnabled = cache(async (): Promise<boolean> => {
  const slug = await getActiveDemoSlug();
  if (slug) {
    const demo = await getTenantBySlug(slug);
    return demo?.medusa.loyalty?.enabled !== false;
  }
  const main = await getMainTenant();
  if (main) return main.medusa.loyalty?.enabled !== false;
  return true;
});

/**
 * Si la sección "Gift Cards" se muestra en esta tienda. Mismo criterio opt-out que
 * `getLoyaltyEnabled`: sólo un `false` explícito la apaga; ausencia y fallo de
 * lectura la dejan visible.
 */
export const getGiftCardsEnabled = cache(async (): Promise<boolean> => {
  const slug = await getActiveDemoSlug();
  if (slug) {
    const demo = await getTenantBySlug(slug);
    return demo?.medusa.giftCards?.enabled !== false;
  }
  const main = await getMainTenant();
  if (main) return main.medusa.giftCards?.enabled !== false;
  return true;
});
