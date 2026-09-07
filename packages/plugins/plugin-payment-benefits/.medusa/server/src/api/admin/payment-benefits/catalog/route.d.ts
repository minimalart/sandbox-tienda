import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/** Catálogo crudo de medios de pago sincronizado del proveedor. */
export declare function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void>;
