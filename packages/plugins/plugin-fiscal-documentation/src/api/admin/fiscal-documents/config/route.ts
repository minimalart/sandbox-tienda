import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { normalizeFiscalConfig } from '../../../../modules/fiscal-documentation/config';
import { readArcaStatus, readFiscalConfig, writeFiscalConfig } from '../_helpers';

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
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const [config, arca] = await Promise.all([readFiscalConfig(req), readArcaStatus(req)]);
  res.json({ config, arca });
}

/**
 * POST /admin/fiscal-documents/config — actualiza la configuración (merge parcial
 * con la actual). Persiste en el setting versionado del site-manager.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const current = await readFiscalConfig(req);
  const merged = normalizeFiscalConfig({ ...current, ...body });
  try {
    const config = await writeFiscalConfig(req, merged);
    res.json({ config });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'No se pudo guardar.' });
  }
}
