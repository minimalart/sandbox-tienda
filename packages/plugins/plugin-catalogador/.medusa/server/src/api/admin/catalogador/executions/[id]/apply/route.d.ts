import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * POST /admin/catalogador/executions/:id/apply
 *
 * Marca la ejecución como `applying`. La aplicación real (snapshots + update de
 * productos, con detección de conflictos y éxito parcial) corre en segundo plano
 * (job catalogador-process → applyExecution). Sólo se aplican productos con
 * status 'accepted' (PRD §18.1).
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<void>;
