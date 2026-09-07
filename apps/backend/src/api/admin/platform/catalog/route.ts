import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { getPlatformConnection } from '../../../../lib/platform/connection';
import { readMercattoLock, readProjectCatalog } from '../../../../lib/platform/project-metadata';

type CatalogTemplate = { id: string; name: string; version: string; status: string; category?: string; description?: string; screenshot?: string; dependencies?: string[] };
type CatalogExtension = { id: string; name: string; version: string; status: string; required?: boolean; category?: string; description?: string; screenshot?: string; dependencies?: string[] };
type Catalog = { templates?: CatalogTemplate[]; extensions?: CatalogExtension[] };

async function loadCatalog(platformUrl: string | null): Promise<{ catalog: Catalog; source: 'platform' | 'local' } | null> {
  if (platformUrl) {
    try {
      const response = await fetch(`${platformUrl}/v1/catalog`);
      if (response.ok) return { catalog: (await response.json()) as Catalog, source: 'platform' };
    } catch {}
  }
  const local = readProjectCatalog() as Catalog | null;
  return local ? { catalog: local, source: 'local' } : null;
}

/**
 * Cruza el catálogo (qué existe para instalar) contra `mercatto.lock.json` (qué está
 * instalado acá). Ruta CORE: ver la nota de `../extensions/route.ts` sobre por qué ya
 * no consulta el override `active` que vivía en site-manager.
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const { platformUrl, configured } = getPlatformConnection();
  const loaded = await loadCatalog(configured ? platformUrl : null);
  if (!loaded) return res.status(404).json({ message: 'Project catalog not found' });

  const lock = readMercattoLock();
  const locked = new Map((lock?.extensions ?? []).map((item) => [item.id, item]));

  const extensions = (loaded.catalog.extensions ?? []).map((extension) => {
    // Sin mercatto.lock.json (boilerplate en desarrollo) el workspace contiene todas las extensiones.
    const entry = locked.get(extension.id);
    const installed = lock ? Boolean(entry) : true;
    return {
      ...extension,
      installed,
      installed_version: entry?.version ?? (installed ? extension.version : null),
      active: installed ? entry?.active ?? true : false,
    };
  });
  const templates = (loaded.catalog.templates ?? []).map((template) => ({
    ...template,
    active: lock?.template?.id === template.id,
  }));

  return res.status(200).json({
    source: loaded.source,
    templates,
    extensions,
    template: lock?.template ?? null,
    platform: { configured, url: platformUrl },
  });
}
