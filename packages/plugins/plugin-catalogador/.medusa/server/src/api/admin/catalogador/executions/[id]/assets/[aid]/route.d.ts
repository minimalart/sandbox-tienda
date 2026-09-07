import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * POST /admin/catalogador/executions/:id/assets/:aid — acepta o rechaza una
 * propuesta de imagen (PRD §12.3: el usuario elige una variación y descarta las
 * demás). body: { decision: 'accept' | 'reject' }. Al aceptar una imagen IA,
 * las otras variaciones de la MISMA operación en ese producto se rechazan.
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<void>;
