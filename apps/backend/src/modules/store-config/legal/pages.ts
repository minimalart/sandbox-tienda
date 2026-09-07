/**
 * Las tres páginas legales del storefront: cuáles son y qué forma tiene su texto.
 *
 * Módulo NEUTRO a propósito — sin `sanitize-html` ni nada de Node. Lo importa
 * TAMBIÉN el bundle del admin (Vite), y es la misma separación que ya hace el blog
 * entre `tiptap-extensions.ts` (compartido) y `render.ts` (server): los textos por
 * defecto y el saneado viven en `defaults.ts`, que sí es de server.
 */

/**
 * Los slugs son los SEGMENTOS REALES de las rutas del storefront
 * (`app/[countryCode]/(main)/legal/{slug}`), no nombres nuevos. Renombrarlos acá
 * rompería el link del footer sin ningún error: `navigation-links.ts` los tiene
 * escritos a mano.
 */
export const LEGAL_PAGE_SLUGS = [
  'legals',
  'conditions',
  'exchangesAndReturns',
] as const;

export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number];

/**
 * Una sección del documento: un ítem del índice lateral y un panel del acordeón.
 *
 * El ORDEN es la posición en el array, no un campo. Un `sort_order` numérico habría
 * que renumerarlo en cada movimiento y deja el estado inconsistente si dos secciones
 * empatan; el array no tiene ese problema y es lo que el editor manipula igual.
 */
export type LegalSection = {
  /**
   * Identidad de la fila para el editor del backoffice (keys de React y reordenado).
   * NO es el ancla: el ancla se deriva del NOMBRE al renderizar, así el índice
   * lateral y el panel siempre coinciden aunque la sección se renombre.
   */
  id: string;
  /** Nombre de la sección: el ítem del índice y el encabezado del acordeón. */
  name: string;
  /** Cuerpo de la sección en HTML ya saneado. */
  html: string;
};

export type LegalPageDoc = {
  /** `<h1>` de la página y su `<title>`. */
  title: string;
  /** Bajada bajo el título. `null` = no se muestra. */
  intro: string | null;
  /**
   * "Última actualización". Es TEXTO LIBRE, no una fecha.
   *
   * El diseño la muestra con precisión de MES ("Agosto de 2026"), así que un `date`
   * obligaría al operador a elegir un día que la página nunca muestra. Y no se deriva
   * de `updated_at` de la fila a propósito: la fecha de una legal es una afirmación
   * que hace el cliente sobre su documento, no el timestamp de la última vez que
   * alguien tocó una coma. `null` = no se muestra.
   */
  updated_label: string | null;
  /** Las secciones, EN ORDEN. Vacío nunca: el merge cae al default. */
  sections: LegalSection[];
  /**
   * Meta description de la ruta. `null` = la que traía el layout hardcodeada.
   *
   * Va acá y no en el layout porque si el operador reescribe el texto, la
   * descripción que lo resume deja de describirlo — y era justo el hallazgo de la
   * auditoría del 19/08 que le puso metadata propia a estas tres URLs.
   */
  seo_description: string | null;
};

/**
 * Lo que ENTRA a un upsert, que NO es un `Partial<LegalPageDoc>`.
 *
 * `Partial` afloja SÓLO el primer nivel: `sections` seguiría exigiendo secciones
 * completas, y el que escribe nunca las manda completas — el `id` ausente lo completa
 * `normalizeSection` con la posición y el HTML recién se sanea ahí. Tipar la entrada
 * como el documento ya normalizado obliga a castear en cada llamador, que es
 * exactamente donde un campo mal escrito deja de ser un error de compilación.
 */
export type LegalPageDocInput = Partial<Omit<LegalPageDoc, 'sections'>> & {
  sections?: Partial<LegalSection>[];
};

export type LegalPages = Record<LegalPageSlug, LegalPageDoc>;

/** Ruta pública de cada página. La usa el admin para el link "ver en el sitio". */
export const LEGAL_PAGE_PATHS: Record<LegalPageSlug, string> = {
  legals: '/legal/legals',
  conditions: '/legal/conditions',
  exchangesAndReturns: '/legal/exchangesAndReturns',
};

export const isLegalPageSlug = (value: unknown): value is LegalPageSlug =>
  typeof value === 'string' && (LEGAL_PAGE_SLUGS as readonly string[]).includes(value);
