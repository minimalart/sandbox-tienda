import type { MedusaContainer } from '@medusajs/framework/types';
/**
 * Job de procesamiento del Catalogador (PRD §14.1, §18.3): drena en segundo
 * plano las ejecuciones en `generating` (genera propuestas por producto) y en
 * `applying` (aplica cambios revisados). Tolera fallas por producto (éxito
 * parcial, PRD §32) y procesa en lotes acotados por tick para no colgar el loop.
 */
export declare const config: {
    name: string;
    schedule: string;
};
export default function catalogadorProcessJob(container: MedusaContainer): Promise<void>;
