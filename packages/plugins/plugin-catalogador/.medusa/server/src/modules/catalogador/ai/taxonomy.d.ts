import type { MedusaContainer } from '@medusajs/framework/types';
/**
 * Taxonomía existente del comercio (categorías y tags). A diferencia del tool
 * original (árbol hardcodeado), en Mercatto la taxonomía es dinámica por tienda:
 * se lee en runtime y se le exige a la IA reutilizar SÓLO entidades existentes
 * (PRD §12.1: no crear categorías/tags nuevos automáticamente).
 */
export type TaxonomyCategory = {
    id: string;
    name: string;
    path: string;
};
export type TaxonomyTag = {
    id: string;
    value: string;
};
export type Taxonomy = {
    categories: TaxonomyCategory[];
    tags: TaxonomyTag[];
    categoryByNormalizedName: Map<string, TaxonomyCategory>;
    tagByNormalizedValue: Map<string, TaxonomyTag>;
};
/** Normaliza acentos/caso para matching robusto (portado del tool original). */
export declare function normalizeName(s: string): string;
/** Carga todas las categorías y tags existentes y arma índices de matching. */
export declare function loadTaxonomy(container: MedusaContainer): Promise<Taxonomy>;
/** Resuelve nombres/paths propuestos por la IA a IDs reales existentes. */
export declare function resolveCategoryIds(taxonomy: Taxonomy, proposed: string[]): string[];
/** Resuelve valores de tag propuestos a IDs existentes (descarta inexistentes). */
export declare function resolveTagIds(taxonomy: Taxonomy, proposed: string[]): string[];
