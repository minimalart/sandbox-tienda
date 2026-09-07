import type { MedusaContainer } from '@medusajs/framework/types';
import type { CatalogadorConfig } from '../config';
/**
 * Procesa las operaciones de imagen de un producto (PRD §12.2/§12.3) y crea
 * `cataloging_asset_proposal` para revisión. Sube los resultados al File module
 * y los registra en la biblioteca de medios. Conserva SIEMPRE los originales y
 * nunca reemplaza la imagen principal (eso se decide al aplicar, sólo si el
 * usuario acepta y la regla lo permite).
 */
export declare function processImagesForProduct(opts: {
    container: MedusaContainer;
    executionId?: string;
    executionProductId: string;
    productId: string;
    config: CatalogadorConfig;
    operations: Array<{
        type: string;
        field: string;
    }>;
    /**
     * URLs de imágenes reales encontradas en la web (Tavily). Se usan como base
     * SÓLO cuando el producto no tiene ninguna foto propia; nunca se alucina desde
     * el título. Vienen del contexto externo ya recolectado en el paso de texto.
     */
    externalImageCandidates?: string[];
}): Promise<{
    created: number;
    warnings: string[];
}>;
