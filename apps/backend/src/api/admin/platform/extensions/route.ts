import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { getPlatformConnection } from '../../../../lib/platform/connection';
import { readMercattoLock } from '../../../../lib/platform/project-metadata';

/**
 * Qué extensiones tiene instalado este backend. La única fuente es
 * `mercatto.lock.json`: si el código no se copió, la extensión no existe.
 *
 * Antes esto cruzaba un override `active` guardado en el namespace `extensions` de
 * site-manager. Se quitó junto con esa extensión: era un write-only dead end (nadie
 * leía el flag fuera de estas mismas rutas) y la instalación se resuelve por PR desde
 * la plataforma, no por un toggle del backoffice. Esta ruta es CORE y no puede
 * depender de un módulo desinstalable.
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const lock = readMercattoLock();
  // `platform.url` sale de `getPlatformConnection()` y no de `process.env` crudo: acá
  // se devolvía sin recortar la barra final mientras `catalog/route.ts` sí la
  // recortaba, así que la misma instalación reportaba dos URLs distintas.
  const { platformUrl, configured } = getPlatformConnection();
  const extensions = (lock?.extensions ?? []).map((extension) => ({
    ...extension,
    active: extension.active ?? true,
  }));
  return res.status(200).json({
    extensions,
    template: lock?.template ?? null,
    platform: { configured, url: platformUrl },
  });
}
