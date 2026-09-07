import 'server-only';
import { cache } from 'react';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000';
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';

export type LegalPageSlug = 'legals' | 'conditions' | 'exchangesAndReturns';

export type LegalSection = {
  /** Identidad de la fila en el backoffice. NO es el ancla: esa sale del nombre. */
  id: string;
  /** Nombre de la sección: ítem del índice lateral y encabezado del acordeón. */
  name: string;
  /** Cuerpo de la sección en HTML, ya SANEADO por el backend al guardarse. */
  html: string;
};

export type LegalPage = {
  /** `<h1>` de la página y su `<title>`. */
  title: string;
  /** Bajada bajo el título. `null` = no se muestra. */
  intro: string | null;
  /**
   * "Última actualización", texto libre ("Agosto de 2026"). `null` = no se muestra.
   * No es un timestamp: es una afirmación que hace el cliente sobre su documento.
   */
  updated_label: string | null;
  /** Las secciones EN ORDEN. El orden del array es el orden de la página. */
  sections: LegalSection[];
  /** Meta description propia, o `null` para dejar la del layout. */
  seo_description: string | null;
};

/**
 * Los textos de las páginas `/legal/*`, editables desde el backoffice
 * (Preferencias → Legales).
 *
 * ─── POR QUÉ NO VIVE EN `content_config` ───────────────────────────────────
 *
 * Porque el `TenantConfig` entero se serializa al cliente: `TenantProvider` se monta
 * en el layout raíz (`app/[countryCode]/layout.tsx`), así que TODA página del sitio
 * paga lo que se agregue ahí. Los tres textos legales completos son decenas de KB de
 * HTML que sólo hacen falta en tres URLs — y son justamente las tres menos visitadas
 * del storefront. Este endpoint aparte lo pagan sólo ellas.
 *
 * `cache()` de React: el `layout` (para el `generateMetadata`) y la `page` piden lo
 * mismo en el mismo render. Sin esto serían dos fetches por visita.
 */
export const getLegalPages = cache(
  async (): Promise<Record<LegalPageSlug, LegalPage> | null> => {
    const url = `${BACKEND_URL}/store/store-config/legal-pages`;
    try {
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(PUBLISHABLE_KEY ? { 'x-publishable-api-key': PUBLISHABLE_KEY } : {}),
        },
        // Igual que el resto de la config pública: los legales se editan dos veces al
        // año, así que un minuto de cache es gratis y el `revalidate` acota cuánto
        // tarda en verse un cambio guardado en el backoffice.
        next: { revalidate: 60, tags: ['legal-pages'] },
      });
      /**
       * Los tres caminos de abajo terminan igual —`null`, y la página publica su
       * versión hardcodeada— pero por motivos MUY distintos, y hasta ahora los tres
       * eran invisibles: un backend viejo sin la ruta (404), uno caído (500) y una
       * publishable key mal puesta (400) daban el mismo síntoma, "el backoffice no
       * cambia nada", sin una sola línea en los logs. Costó una tarde de
       * investigación averiguar cuál era. Mismo criterio que `tinting.ts`.
       */
      if (!res.ok) {
        console.error(
          `[legal-pages] ${url} → ${res.status}. Las páginas /legal/* publican su ` +
            'versión hardcodeada y lo editado en el backoffice no se ve.',
        );
        return null;
      }
      const data = (await res.json()) as {
        legal_pages?: Record<LegalPageSlug, LegalPage>;
      };
      if (!data.legal_pages) {
        console.error(
          `[legal-pages] ${url} → 200 sin \`legal_pages\` en el cuerpo. Las ` +
            'páginas /legal/* publican su versión hardcodeada.',
        );
        return null;
      }
      return data.legal_pages;
    } catch (err) {
      // Sin backend las legales caen al hardcodeado, pero el resto del sitio sigue.
      console.error(
        `[legal-pages] ${url} → ${(err as Error)?.message ?? String(err)}. Las ` +
          'páginas /legal/* publican su versión hardcodeada.',
      );
      return null;
    }
  },
);

/**
 * Una página legal, o `null` si el backend no contestó.
 *
 * `null` NO significa "no hay texto": el backend siempre completa con el texto por
 * defecto. Significa "no se pudo preguntar" — backend viejo (la ruta todavía no
 * existe), caído, o la publishable key mal puesta. En ese caso la página cae a su
 * versión hardcodeada, que es la que se venía publicando. Es a propósito: una página
 * legal en blanco es peor que una con el texto de siempre.
 *
 * Envuelta en `cache()` igual que `getLegalPages`, y no sólo por el fetch: el
 * `generateMetadata` del layout y la `page` la llaman las dos en el mismo render, así
 * que sin esto el `console.error` de abajo saldría DOS veces por visita.
 */
export const getLegalPage = cache(
  async (slug: LegalPageSlug): Promise<LegalPage | null> => {
    const pages = await getLegalPages();
    const page = pages?.[slug];
    // `pages` en null ya se logueó arriba con su causa; esto es el otro caso, que el
    // backend propio no produce nunca: contestó, pero esta página vino sin secciones.
    if (pages && !page?.sections?.length) {
      console.error(
        `[legal-pages] "${slug}" llegó sin secciones. Esa página publica su versión ` +
          'hardcodeada; el resto de las legales no se ve afectado.',
      );
    }
    // Se exige al menos UNA sección: un objeto presente pero sin secciones también
    // tiene que caer al fallback, o la página se publica en blanco. El backend nunca
    // devuelve eso (rellena con el default), pero un backend viejo que responda otra
    // forma sí — y ahí el fallback es lo correcto, no un `.map` sobre `undefined`.
    return page?.sections?.length ? page : null;
  },
);
