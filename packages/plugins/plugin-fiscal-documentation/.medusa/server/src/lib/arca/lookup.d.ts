import { type ArcaConfig } from './config';
import { type ArcaCache, type NormalizedTaxpayer } from './types';
export declare function lookupTaxpayer(rawCuit: string, opts: {
    cache: ArcaCache;
    fetchImpl?: typeof globalThis.fetch;
    /**
     * La config de LA TIENDA que consulta. Sin esto se usa la de la INSTANCIA, que
     * es correcto sólo donde no hay contenedor: ver el cartel de `config.ts`. Los
     * dos call sites reales —la ruta store y la de admin— sí la pasan.
     */
    config?: ArcaConfig;
}): Promise<NormalizedTaxpayer>;
