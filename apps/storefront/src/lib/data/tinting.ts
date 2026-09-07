import "server-only";
import { cache } from "react";
import {
  getActiveSiteSlug,
  getMainTenant,
  getTenantBySlug,
} from "@lib/site-config/active-tenant";
import { resolveTintingGate, type TintingGate } from "./tinting-gate";

/**
 * Carta de colores del sistema tintométrico, para el flujo color → bases.
 *
 * La decisión de qué se muestra vive en el módulo PURO `tinting-gate.ts`; acá
 * está sólo el I/O que la alimenta. Las dos llaves son la fila del sitio
 * (/app/sites) y el switch del ERP: la primera dice si esta tienda muestra la
 * vidriera, el segundo si hay datos maestros que mostrar.
 */

export type TintCatalogColor = {
  code: string;
  name: string;
  collection: string;
  family: string | null;
  hex: string | null;
};

export type TintCatalog = {
  enabled: boolean;
  /** El switch del ERP está prendido Y la carta tiene colores. */
  ready: boolean;
  collections: string[];
  colors: TintCatalogColor[];
};

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";

const EMPTY: TintCatalog = {
  enabled: false,
  ready: false,
  collections: [],
  colors: [],
};

export const getTintingCatalog = cache(async (): Promise<TintCatalog> => {
  const url = `${BACKEND_URL}/store/tinting/catalog`;
  try {
    const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(pk ? { "x-publishable-api-key": pk } : {}),
      },
      next: { revalidate: 300, tags: ["tinting-catalog"] },
    });
    if (!res.ok) {
      /**
       * Loguear el status, por la misma razón que `fetchSiteConfig`: una
       * publishable key de otra instancia (400), un backend sin la extensión ERP
       * (404) y un ERP caído (500) producían los tres el mismo síntoma —la página
       * de colores no existe— sin una sola línea en los logs.
       */
      console.error(
        `[tinting] ${url} → ${res.status}. La página de colores no se muestra. ` +
          `publishable key ${pk ? "presente" : "AUSENTE"}.`,
      );
      return EMPTY;
    }
    const data = (await res.json()) as Partial<TintCatalog>;
    const colors = data.colors ?? [];
    return {
      enabled: Boolean(data.enabled),
      // `ready` es aditivo en el backend: si el deploy del backend es más viejo que
      // este, se deriva del largo de la carta, que es exactamente lo que significa.
      ready: data.ready ?? colors.length > 0,
      collections: data.collections ?? [],
      colors,
    };
  } catch (err) {
    // Sin backend la página no se muestra, pero el resto del sitio sigue.
    console.error(
      `[tinting] ${url} → ${(err as Error)?.message ?? String(err)}. ` +
        `La página de colores no se muestra.`,
    );
    return EMPTY;
  }
});

/**
 * Las dos llaves del tintómetro para ESTA request.
 *
 * Devuelve las dos decisiones por separado —si la ruta existe y si hay carta—
 * porque no son la misma: ver `tinting-gate.ts`. Loguea el motivo cuando algo
 * está apagado con la feature prendida, que era el agujero de diagnóstico: el
 * admin sabía que la carta estaba vacía (`readiness.ready: false` en
 * `/admin/erp/tinting`) y el storefront hacía 404 en silencio.
 */
export const getTintingGate = cache(async (): Promise<TintingGate> => {
  const slug = await getActiveSiteSlug();
  // La fila del sitio activo, o la de la tienda PRINCIPAL cuando no hay slug.
  // `null` = no se pudo leer, que NO es lo mismo que "apagado" (ver el gate).
  const site = slug ? await getTenantBySlug(slug) : await getMainTenant();
  const catalog = await getTintingCatalog();

  const gate = resolveTintingGate({
    siteTinting: site ? Boolean(site.medusa.tinting?.enabled) : null,
    isMainSite: !slug,
    catalog: {
      enabled: catalog.enabled,
      colorCount: catalog.colors.length,
      ready: catalog.ready,
    },
  });

  if (gate.reason === "empty-catalog") {
    console.warn(
      `[tinting] ${slug ?? "tienda principal"}: tintometría habilitada pero la ` +
        `carta está VACÍA, así que /colores muestra su empty state y el link del ` +
        `menú queda oculto. Importá los colores (POST /admin/erp/tinting/import, ` +
        `kind: colors) — ver docs/recipes/erp-tinting-carta-alba.md.`,
    );
  }

  if (gate.reason === "no-sellable-bases") {
    console.warn(
      `[tinting] ${slug ?? "tienda principal"}: hay carta cargada pero NINGUNA ` +
        `base confirmada existe como producto vendible, así que todos los colores ` +
        `terminarían en "no tenemos productos". /colores muestra su empty state y ` +
        `el link del menú queda oculto. Dá de alta las bases con ` +
        `POST /admin/erp/tinting/bases/sync-products (arranca en dry run) — el ` +
        `catalog sync NO las trae, las descarta por publica_en_ecommerce.`,
    );
  }

  return gate;
});

/**
 * @deprecated Usar `getTintingGate`. Equivale a `catalogReady` y se mantiene para
 * no romper los proyectos que ya salieron del boilerplate con esta firma.
 */
export const getTintingEnabled = async (): Promise<boolean> =>
  (await getTintingGate()).catalogReady;
