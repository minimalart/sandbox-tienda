import type { CatalogadorConfig } from '../config';
/**
 * Enriquecimiento externo (PRD §13 / §22.4): consulta por barcode y scraping
 * controlado. Los datos encontrados NUNCA se aplican directo: sólo se devuelven
 * como CONTEXTO para que la IA genere una propuesta revisable (PRD §13.2).
 *
 * Los secretos (API keys) NO viven en `CatalogadorConfig`: se resuelven por
 * `app-settings` (fila cifrada en DB > env > default) vía
 * `getCatalogadorSettings()`, que es sincrónico a propósito — estas funciones ya
 * están dentro de un fetch con AbortController y no reciben el contenedor.
 */
export type ExternalContext = {
    summary: string | null;
    sources: Array<{
        type: 'barcode' | 'scraping';
        ref: string;
        ok: boolean;
        note?: string;
    }>;
    used_barcode: boolean;
    used_scraping: boolean;
    /** Cuántas páginas web devolvieron contenido útil (para ponderar confianza). */
    page_hits: number;
    /**
     * URLs de imágenes REALES encontradas en la web (Tavily `include_images`). Se
     * usan como base/referencia para imágenes cuando el producto no tiene ninguna
     * foto propia — nunca se alucina desde el título.
     */
    image_candidates: string[];
    warnings: string[];
};
/**
 * Extrae URLs de imagen de una respuesta JSON arbitraria de un proveedor de
 * barcode (recorrido recursivo acotado). Acepta strings http(s) cuyo path
 * termina en extensión de imagen, o bajo claves que sugieren imagen
 * (`image`, `images`, `image_url`, `thumbnail`, `photo`, `picture`, …).
 * Exportada para tests.
 */
export declare function extractImageUrls(value: unknown, limit?: number): string[];
/** Orquesta barcode + scraping según config; devuelve contexto para la IA. */
export declare function gatherExternalContext(opts: {
    config: CatalogadorConfig;
    barcode: string | null;
    title: string;
}): Promise<ExternalContext | null>;
