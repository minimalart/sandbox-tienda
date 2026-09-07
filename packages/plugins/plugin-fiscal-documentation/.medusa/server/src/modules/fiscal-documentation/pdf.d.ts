import type { FiscalSnapshot } from './types';
/** Etiquetas legibles de la condición IVA para el PDF. */
declare const TAX_CONDITION_LABELS: Record<string, string>;
export type ConstanciaPdfInput = {
    snapshot: FiscalSnapshot;
    /** Nombre de la empresa dueña (corporate/company). */
    ownerName: string;
    /** Momento de generación del documento. */
    generatedAt: Date;
    /** Marca institucional del encabezado. Default "Mercatto". */
    brandName?: string;
    /** Logo opcional (PNG) para el encabezado. */
    logoPng?: Buffer | Uint8Array;
    /** Pie institucional configurable. */
    footer?: string;
};
/**
 * Genera el PDF de la constancia de situación fiscal como Buffer.
 * Usa fuentes estándar embebidas (sin lecturas de disco en runtime).
 */
export declare function generateConstanciaPdf(input: ConstanciaPdfInput): Promise<Buffer>;
export { TAX_CONDITION_LABELS };
