import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * GET /admin/fiscal-documents/config — configuración actual de la extensión.
 *
 * `arca` viaja al lado y NO adentro de `config`: son dos cosas distintas guardadas
 * en dos lugares distintos. `config` es el jsonb plano de la extensión, que este
 * endpoint también ESCRIBE; `arca` es el estado de la conexión con AFIP, que sale de
 * `site_setting` + `site_credential` y desde acá es de SÓLO LECTURA — se edita en
 * "Ajustes de extensiones" y en "Credenciales por tienda". Mezclarlos haría que el
 * POST de abajo, que mergea `{...current, ...body}`, terminara persistiendo el
 * estado de ARCA como si fuera configuración.
 *
 * Nunca incluye material del certificado: `readArcaStatus` devuelve booleanos.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
/**
 * POST /admin/fiscal-documents/config — actualiza la configuración (merge parcial
 * con la actual). Persiste en el setting versionado del site-manager.
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<void>;
