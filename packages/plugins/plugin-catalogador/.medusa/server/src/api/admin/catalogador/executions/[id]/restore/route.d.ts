import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * POST /admin/catalogador/executions/:id/restore — crea una ejecución de tipo
 * Restauración (PRD §19.4/§20) que reescribe los valores previos (`pre`
 * snapshot) de los productos afectados. Nunca elimina el historial original. La
 * detección de conflictos (cambios posteriores) ocurre al aplicar, comparando
 * contra lo último que escribió la ejecución original (`post` snapshot).
 *
 * body: { product_ids?: string[] } — restaura sólo esos; si falta, toda la ejecución.
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<void>;
