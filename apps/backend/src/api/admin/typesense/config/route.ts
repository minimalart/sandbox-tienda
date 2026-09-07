import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import TypeSenseService from '../../../../modules/typesense/service';
import { getTypesenseSettings } from '../../../../modules/typesense/settings';

/**
 * GET /admin/typesense/config — configuración real de conexión, en runtime.
 *
 * El admin leía variables `VITE_TYPESENSE_*` de build time, que no se inyectan
 * al bundle en el deploy, así que siempre mostraba "Sin definir" aunque el
 * backend estuviera perfectamente conectado. Este endpoint reporta lo que el
 * servidor está usando de verdad, más una sonda de conectividad.
 *
 * Desde la migración a `app-settings` lee del resolver (DB > env > default) en
 * vez de `process.env` directo, así que sirve de verificación end-to-end: si acá
 * se ve el valor guardado desde el admin, la cadena entera funciona.
 */
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const settings = getTypesenseSettings();

  let connected = false;
  let documentCount: number | null = null;
  try {
    const service = new TypeSenseService();
    const result = await service.advancedSearch({
      q: '*',
      query_by: 'title',
      per_page: 1,
      page: 1,
    });
    connected = true;
    documentCount = result.found ?? 0;
  } catch (error) {
    console.error('[Typesense config] connectivity probe failed:', error);
    connected = false;
  }

  res.json({
    host: settings.host,
    port: settings.port,
    protocol: settings.protocol,
    collection: settings.collectionName,
    apiKeySet: Boolean(settings.apiKey),
    connected,
    documentCount,
  });
};
