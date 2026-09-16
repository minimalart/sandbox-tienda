import type { TenantConfig } from "./types";

/**
 * Deja fuera del payload al cliente los bloques de contenido que ningún Client
 * Component lee: los templates que esta tienda NO usa, y las secciones de home
 * del baseline.
 *
 * ─── QUÉ PASABA ──────────────────────────────────────────────────────────────
 *
 * `TenantProvider` es un Client Component, así que el `TenantConfig` entero se
 * serializa dentro del payload RSC de CADA página. Y `getTenantBySlug()` /
 * `getMainTenant()` mergean los CUATRO configs de template (`technology`, `fashion`,
 * `techRetail`, `sports`) dentro de `assets` como fallback, para que una tienda que
 * sólo cargó branding tenga igual una home completa si algún día cambia de template.
 *
 * Combinadas, esas dos decisiones razonables dan una mala: desdeelsur es `grocery` y
 * cada respuesta HTML suya arrastraba las categorías, los banners y las fotos de
 * Unsplash de las otras cuatro verticales. En el HTML servido en producción se leían
 * "Celulares", "Notebooks", "Smart Home", "Setup gamer", "Mercatto Tech",
 * "Indumentaria" y "Calzado" — el punto 4 de DESDEELSUR-49, "contenidos residuales de
 * otras plantillas". No se VEÍAN (ningún componente de esos templates se monta con
 * `template: "grocery"`), pero estaban en el documento, y una auditoría que mira el
 * HTML generado los encuentra igual. Con razón: son ~100 KB por respuesta y describen
 * un catálogo que la tienda no vende.
 *
 * ─── LA SEGUNDA MITAD (DESDEELSUR-61, BUG-10) ────────────────────────────────
 *
 * Recortar los templates inactivos no alcanzaba, porque el leak más grande no venía
 * de `assets.technology` sino del PROPIO template activo. `defaultConfig` es el
 * baseline de CUALQUIER deploy del boilerplate, pero su contenido es el de un
 * supermercado concreto; y `mergeMainTenant` hace `{ ...base.assets, ...payload.assets }`,
 * shallow por clave. O sea: toda sección de home que la fila del sitio no define se
 * queda con la del demo.
 *
 * En el HTML de producción de desdeelsur —una pinturería— eso dejaba
 * `{"name":"Mercatto","src":"/logo_full.webp"}` en `partners`, un `moreProducts`
 * titulado "Recorré todo el supermercado", `collections` con "Frutas y Verduras" y
 * heroSlides con "Ver frescos". QA lo encontró leyendo el código fuente (Ctrl+U): no
 * se ve en pantalla, pero incumple el requisito de que no quede ninguna referencia a
 * Mercatto en el sitio del cliente.
 *
 * ─── POR QUÉ ES SEGURO ───────────────────────────────────────────────────────
 *
 * Mismo argumento que el recorte de templates: sólo se deja de mandar lo que nadie
 * iba a leer del otro lado.
 *
 * Las secciones de home son SERVER-ONLY por construcción. `HomeRenderer` es un
 * `async function` Server Component: monta los bloques del documento Puck
 * (`assets.homeLayout`) y les pasa el contenido de `assets` ya resuelto. Los
 * componentes de sección lo reciben como props ya serializadas — ninguno lee el
 * tenant desde el contexto del cliente. Se verificó clave por clave: el único bloque
 * de contenido con un lector `"use client"` es `searchSuggestions`
 * (`modules/layout/components/header-search-bar`), y POR ESO no está en esta lista.
 *
 * Recortar acá y no en el merge es deliberado, por la misma razón que el recorte de
 * templates: los Server Components tienen que seguir viendo el tenant completo.
 *
 * ─── DÓNDE APLICARLO ─────────────────────────────────────────────────────────
 *
 * En el borde: justo antes de `<TenantProvider tenant={…}>`, y NO dentro de
 * `getActiveTenant()`. Los Server Components tienen que seguir viendo el tenant
 * completo — es el mismo objeto con el que `(main)/layout.tsx` decide qué chrome
 * montar. Recortar río arriba haría que el tenant signifique cosas distintas según
 * quién lo pida.
 */

/** `template` del tenant → clave de `assets` donde vive su contenido. */
const TEMPLATE_ASSET_KEY = {
  technology: "technology",
  fashion: "fashion",
  "tech-retail": "techRetail",
  sports: "sports",
} as const;

const ALL_TEMPLATE_ASSET_KEYS = Object.values(TEMPLATE_ASSET_KEY);

/**
 * Secciones de home que sólo lee el server (vía `HomeRenderer`) y por lo tanto no
 * tienen por qué viajar en el payload RSC.
 *
 * AL AGREGAR UNA CLAVE ACÁ: confirmá que ningún archivo con `"use client"` la lee
 * desde el contexto del tenant. Si algún día una sección se vuelve client-side, sacala
 * de esta lista — de lo contrario le llega `undefined` y la sección desaparece en
 * silencio, sin error de build ni de tipos.
 *
 * `searchSuggestions` NO va acá: la lee `header-search-bar`, que es un Client Component.
 */
const SERVER_ONLY_HOME_KEYS = [
  "heroBanners",
  "featuredCategories",
  "newArrivals",
  "featuredProducts",
  "novedades",
  "renovaEnergia",
  "destacadosDelMes",
  "collections",
  "partners",
  "moreProducts",
  "resellerKits",
  "shoppableVideos",
] as const;

export function tenantForClient(tenant: TenantConfig): TenantConfig {
  const active =
    TEMPLATE_ASSET_KEY[tenant.template as keyof typeof TEMPLATE_ASSET_KEY];

  const assets: Record<string, unknown> = { ...(tenant.assets ?? {}) };
  for (const key of ALL_TEMPLATE_ASSET_KEYS) {
    if (key !== active) delete assets[key];
  }
  for (const key of SERVER_ONLY_HOME_KEYS) {
    delete assets[key];
  }

  return { ...tenant, assets: assets as TenantConfig["assets"] };
}
