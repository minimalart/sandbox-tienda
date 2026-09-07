import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * POST /admin/catalogador/executions/:id/refloat — crea una NUEVA ejecución en
 * borrador basada en una histórica (PRD §20). Copia selección + operaciones. NO
 * reutiliza las propuestas anteriores (para eso está "duplicar"). El usuario
 * elige config histórica o vigente vía body.
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<void>;
