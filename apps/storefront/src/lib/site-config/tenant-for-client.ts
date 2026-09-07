import type { TenantConfig } from "./types";

/**
 * Deja fuera del payload al cliente los bloques de contenido de los templates que esta
 * tienda NO usa.
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
 * ─── POR QUÉ ES SEGURO ───────────────────────────────────────────────────────
 *
 * Los únicos lectores de estos bloques viven en `modules/home-technology`,
 * `home-fashion`, `home-tech-retail` y `home-sports`, y los cuatro se montan
 * exclusivamente detrás de su propio `template` (`(main)/layout.tsx` y
 * `demo/[slug]/page.tsx` lo chequean antes de renderizar). Un template que no está
 * activo no tiene quién lea su bloque.
 *
 * El bloque del template ACTIVO se conserva entero. Esto no cambia nada de lo que se
 * ve: sólo deja de mandar lo que nadie iba a leer.
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

export function tenantForClient(tenant: TenantConfig): TenantConfig {
  const active =
    TEMPLATE_ASSET_KEY[tenant.template as keyof typeof TEMPLATE_ASSET_KEY];

  const assets: Record<string, unknown> = { ...(tenant.assets ?? {}) };
  for (const key of ALL_TEMPLATE_ASSET_KEYS) {
    if (key !== active) delete assets[key];
  }

  return { ...tenant, assets: assets as TenantConfig["assets"] };
}
