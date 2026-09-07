import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/** Detalle de un beneficio. */
export declare function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void>;
/** Edita un beneficio (respeta el guard read-only del servicio). */
export declare function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void>;
/** Elimina un beneficio (soft-delete). */
export declare function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void>;
