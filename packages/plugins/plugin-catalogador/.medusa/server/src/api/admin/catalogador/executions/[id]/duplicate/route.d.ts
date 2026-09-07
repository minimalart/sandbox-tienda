import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * POST /admin/catalogador/executions/:id/duplicate — clona una ejecución como
 * nuevo BORRADOR, copiando selección + operaciones + config y TAMBIÉN las
 * propuestas ya generadas (a diferencia de "reflotar", que no las reutiliza —
 * PRD §20).
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<void>;
