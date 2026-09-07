import type { MedusaContainer } from '@medusajs/framework/types';
import type { CatalogadorConfig } from '../config';
import { type ChatUsage } from './openrouter';
import { type TextField } from './prompts';
import { loadTaxonomy, type Taxonomy } from './taxonomy';
/** Traza resumida de las fuentes usadas para una propuesta (PRD §13.3). */
export type SourceTrace = {
    catalog: boolean;
    image: boolean;
    barcode: boolean;
    scraping: boolean;
    ai_inferred: boolean;
};
export type ProposedField = {
    value: unknown;
    attempt: number;
    confidence: number | null;
    source_trace: SourceTrace;
    warnings?: string[];
};
export type GenerationResult = {
    proposed_changes: Record<string, ProposedField>;
    current_snapshot: Record<string, unknown>;
    product_version_reference: {
        hash: string;
        captured_at: string;
    };
    external_context_summary: Record<string, unknown> | null;
    /** Imágenes reales encontradas en la web (para el pipeline de imágenes). */
    external_image_candidates: string[];
    warnings: string[];
    usage?: ChatUsage;
    no_changes: boolean;
};
/**
 * Confianza según la fuerza de la evidencia disponible (PRD §13). No es un
 * sistema sofisticado: mapea las fuentes que realmente alimentaron la propuesta
 * a un valor orientativo.
 *
 * La foto del producto cuenta como evidencia de primera mano: cuando hay imagen
 * el modelo la mira (va como `image_url` en el mensaje) y describe lo que ve, no
 * lo que deduce del título. Antes esta función sólo puntuaba barcode y scraping
 * —las dos fuentes EXTERNAS—, así que un tenant con ambas apagadas en su config
 * tenía un techo alcanzable de 0.55 contra el umbral por default de 0.7: el gate
 * de `require_review_low_confidence` difería el 100% de los campos siempre y
 * "aceptar todo" era incapaz de aceptar nada. Un gate cuyo techo está por debajo
 * de su propio umbral no discrimina: sólo apaga el botón.
 *
 * Con la imagen puntuando, el gate vuelve a separar dos casos que sí son
 * distintos: producto CON foto (0.7, el modelo vio el envase) y producto SIN
 * foto (0.55, la IA está infiriendo del catálogo) — que es justo donde querés
 * ojo humano.
 */
export declare function evidenceConfidence(opts: {
    usedBarcode: boolean;
    pageHits: number;
    hasImage: boolean;
}): number;
/**
 * Genera propuestas para un producto (PRD §13.1). Orden: lee info existente →
 * taxonomías → imagen → contexto externo (barcode/scraping) → IA → validación.
 * NO escribe en el catálogo: sólo devuelve las propuestas para revisión.
 */
export declare function generateForProduct(opts: {
    container: MedusaContainer;
    productId: string;
    fields: TextField[];
    config: CatalogadorConfig;
    taxonomy: Taxonomy;
    attempt: number;
}): Promise<GenerationResult>;
export { loadTaxonomy };
