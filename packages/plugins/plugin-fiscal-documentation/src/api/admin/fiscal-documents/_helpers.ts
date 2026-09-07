import type { MedusaRequest } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';
import {
  arcaPgFrom,
  getArcaConfigForSite,
  loadArcaStatusViaPg,
  type ArcaConfig,
  type ArcaConfigStatus,
} from '../../../lib/arca/config';
import type { ArcaCache } from '../../../lib/arca/types';
import {
  DEFAULT_FISCAL_CONFIG,
  FISCAL_CONFIG_NAMESPACE,
  normalizeFiscalConfig,
  type FiscalConfig,
} from '../../../modules/fiscal-documentation/config';
import type { FiscalOwnerType, FiscalSnapshot } from '../../../modules/fiscal-documentation/types';

import { siteFromRequest } from '../../../lib/multistore/request';

import { FISCAL_DOCUMENTATION_MODULE } from '../../../modules/fiscal-documentation';

/**
 * SHIM del plugin — variantes de `CORPORATE_SITE_SCOPE` y `COMPANY_SITE_SCOPE`.
 *
 * Los descriptores originales viven en `apps/backend/src/modules/corporate/site-scope.ts`
 * y `.../company/site-scope.ts`. El plugin no los puede importar sin acoplarse al
 * árbol del host, así que acá se replican con las columnas mínimas —`site_id` en
 * `corporate` y en `company` respectivamente— manteniendo el mismo `empty: 'all'`
 * histórico. Si el host cambia la forma física (jsonb, tabla puente), este shim
 * queda desactualizado en silencio hasta que `multistore` se plugin-ifique.
 *
 * `assertIdInSite` viene de `lib/multistore/scope.ts` (vendorizado desde catalogador).
 */
import { assertIdInSite } from '../../../lib/multistore/scope';
import type { SiteScopeDescriptor } from '../../../lib/multistore/scope';

const CORPORATE_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'site_column',
  table: 'corporate',
  column: 'site_id',
  empty: 'all',
};

const COMPANY_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'site_column',
  table: 'company',
  column: 'site_id',
  empty: 'all',
};

/** Fallback in-memory por si el módulo CACHE no resuelve (mismo patrón que store/arca). */
const MEMORY_CACHE_MAX = 2_000;
const memoryStore = new Map<string, { data: unknown; expiresAt: number }>();
const memoryArcaCache: ArcaCache = {
  async get<T>(key: string): Promise<T | null> {
    const entry = memoryStore.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      memoryStore.delete(key);
      return null;
    }
    return entry.data as T;
  },
  async set(key: string, data: unknown, ttl = 3600): Promise<void> {
    if (memoryStore.size > MEMORY_CACHE_MAX) {
      const now = Date.now();
      for (const [k, v] of memoryStore) {
        if (v.expiresAt <= now) memoryStore.delete(k);
      }
    }
    memoryStore.set(key, { data, expiresAt: Date.now() + ttl * 1000 });
  },
};

export function resolveArcaCache(req: MedusaRequest): ArcaCache {
  try {
    const cache = req.scope.resolve(Modules.CACHE) as unknown as ArcaCache | undefined;
    if (cache && typeof cache.get === 'function' && typeof cache.set === 'function') {
      return cache;
    }
  } catch {
    /* fallback */
  }
  return memoryArcaCache;
}

/** Logger mínimo para los caminos de ARCA, que sólo avisan cuando degradan. */
function arcaWarnLogger(req: MedusaRequest): { warn: (line: string) => void } {
  try {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
    return { warn: (line) => logger.warn(line) };
  } catch {
    return { warn: (line) => console.warn(line) };
  }
}

/**
 * La config de ARCA de la TIENDA ACTIVA del admin.
 *
 * Sin esto, emitir una constancia desde la pantalla de la tienda B consultaba AFIP
 * con el certificado de la instancia — o sea, en nombre del contribuyente
 * equivocado— y el documento quedaba archivado como si fuera de B. Es el mismo bug
 * que `correo-argentino-fulfillment/get-client.ts` documenta para el despacho, con
 * la diferencia de que acá el rastro es fiscal.
 *
 * TIRA cuando la tienda no tiene identidad fiscal propia (fail-closed) o cuando sus
 * credenciales no se pueden descifrar. Los dos casos los traduce el caller a un 424,
 * que es el contrato que ya tenía la ruta.
 */
export async function resolveArcaConfig(req: MedusaRequest): Promise<ArcaConfig> {
  return getArcaConfigForSite(req.scope, { siteId: await fiscalSiteOf(req) }, arcaWarnLogger(req));
}

/**
 * Estado de la conexión con ARCA para la card del admin. NUNCA material sensible.
 *
 * Devuelve `null` si ni siquiera se pudo leer la configuración: la card muestra la
 * sección vacía en vez de romper la pantalla entera de Preferencias, que también
 * sirve para cosas que no tienen nada que ver con ARCA.
 */
export async function readArcaStatus(req: MedusaRequest): Promise<ArcaConfigStatus | null> {
  try {
    return await loadArcaStatusViaPg(arcaPgFrom(req.scope), { siteId: await fiscalSiteOf(req) });
  } catch {
    return null;
  }
}

/**
 * Nombre de la empresa dueña, para el encabezado del PDF. Best-effort: los
 * módulos corporate/company son opcionales y pueden no estar instalados.
 */
export async function resolveOwnerName(
  req: MedusaRequest,
  ownerType: FiscalOwnerType,
  ownerId: string,
): Promise<string> {
  try {
    if (ownerType === 'corporate') {
      const service = req.scope.resolve('corporate') as {
        retrieveCorporate: (id: string) => Promise<{ name?: string; legal_name?: string }>;
      };
      const c = await service.retrieveCorporate(ownerId);
      return c?.legal_name || c?.name || '';
    }
    const service = req.scope.resolve('company') as {
      retrieveCompany: (id: string) => Promise<{ name?: string; legal_name?: string }>;
    };
    const c = await service.retrieveCompany(ownerId);
    return c?.legal_name || c?.name || '';
  } catch {
    return '';
  }
}

/**
 * La configuración fiscal vive en `site_setting`, dentro del módulo de tiendas.
 *
 * Antes vivía en `site_manager_setting`. Al desmantelar esa extensión el namespace
 * se mudó tal cual —`extension:fiscal-documentation`—, así que el dato no cambia de
 * forma: cambia de casa, y gana `site_id` de regalo.
 *
 * Se resuelve por STRING LITERAL y no importando la constante porque este archivo se
 * le entrega a proyectos de cliente que pueden no tener el módulo instalado, y un
 * import colgado rompe el build. Lo vigila `modules/module-keys.test.ts`, que ya
 * atrapó una vez que este literal estuviera en kebab (`site-manager`) cuando la clave
 * era camelCase: la config leía SIEMPRE los defaults y el guardado tiraba siempre,
 * sin un error que apuntara a la causa.
 */
type SiteSettingsLike = {
  getSiteSetting: (
    namespace: string,
    siteId?: string | null,
  ) => Promise<{ value: Record<string, unknown>; revision: number }>;
  upsertSiteSetting: (input: {
    namespace: string;
    value: Record<string, unknown>;
    siteId?: string | null;
    actorId?: string | null;
  }) => Promise<{ value: Record<string, unknown>; revision: number }>;
};

function resolveSiteSettings(req: MedusaRequest): SiteSettingsLike | null {
  try {
    return req.scope.resolve('demo_store') as unknown as SiteSettingsLike;
  } catch {
    return null;
  }
}

/** Config de la extensión (best-effort: defaults si el módulo no resuelve). */
/**
 * Exige que el owner (empresa o corporate) sea de la tienda activa.
 *
 * El documento fiscal no tiene eje propio —`owner_type` es polimórfico—, pero su dueño
 * sí: los dos tipos posibles ya saben a qué tienda pertenecen. Sin esto, saber el
 * `owner_id` de una empresa ajena alcanza para ver su constancia de AFIP, que trae
 * CUIT, razón social y domicilio fiscal.
 */
export async function assertFiscalOwnerInSite(
  req: MedusaRequest,
  ownerType: 'corporate' | 'company',
  ownerId: string,
): Promise<void> {
  const resolution = await siteFromRequest(req);
  const descriptor = ownerType === 'corporate' ? CORPORATE_SITE_SCOPE : COMPANY_SITE_SCOPE;
  await assertIdInSite(req.scope, resolution, descriptor, ownerId);
}

/**
 * Igual que `assertFiscalOwnerInSite`, pero cuando lo único que hay es el id del
 * documento: se lee su owner y se valida ese.
 *
 * Hace falta en el detalle, el diff y la descarga — las tres reciben un `fdoc_...` y
 * ninguna pide el owner. Sin esto, un id adivinado baja el PDF de la constancia de otra
 * tienda, con CUIT y domicilio fiscal adentro.
 */
export async function assertFiscalDocumentInSite(
  req: MedusaRequest,
  documentId: string,
): Promise<void> {
  const service = req.scope.resolve(FISCAL_DOCUMENTATION_MODULE) as {
    retrieveFiscalDocument: (id: string) => Promise<{ owner_type: string; owner_id: string } | null>;
  };
  const doc = await service.retrieveFiscalDocument(documentId).catch(() => null);
  if (!doc) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No encontrado.');
  if (doc.owner_type !== 'corporate' && doc.owner_type !== 'company') return;
  await assertFiscalOwnerInSite(req, doc.owner_type, doc.owner_id);
}

/** La tienda activa, o `null` para la fila GLOBAL de la instancia. */
export async function fiscalSiteOf(req: MedusaRequest): Promise<string | null> {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
}

/**
 * La configuración fiscal EFECTIVA: la de la tienda si la definió, la global si no.
 *
 * Es la config más sensible del repo — CUIT, punto de venta, condición frente al IVA.
 * `getSiteSetting` lee EXACTAMENTE el scope que se le pide (no hace precedencia), así
 * que la cadena se arma acá: primero la tienda, después la global.
 *
 * Sin este fallback, una tienda que todavía no configuró lo suyo se quedaría sin
 * ninguna config en vez de heredar la de la instancia, y dejaría de emitir.
 */
export async function readFiscalConfig(req: MedusaRequest): Promise<FiscalConfig> {
  const settings = resolveSiteSettings(req);
  if (!settings) return DEFAULT_FISCAL_CONFIG;
  try {
    const siteId = await fiscalSiteOf(req);
    if (siteId) {
      const own = await settings.getSiteSetting(FISCAL_CONFIG_NAMESPACE, siteId);
      if (own.value && Object.keys(own.value).length > 0) return normalizeFiscalConfig(own.value);
    }
    const global = await settings.getSiteSetting(FISCAL_CONFIG_NAMESPACE);
    return normalizeFiscalConfig(global.value);
  } catch {
    return DEFAULT_FISCAL_CONFIG;
  }
}

export async function writeFiscalConfig(
  req: MedusaRequest,
  config: FiscalConfig,
): Promise<FiscalConfig> {
  const settings = resolveSiteSettings(req);
  if (!settings) throw new Error('El módulo de tiendas no está disponible.');
  const actorId = (req as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null;
  /**
   * Escribe la fila de la TIENDA activa, no la global.
   *
   * Guardar en la global desde la pantalla de una tienda le cambiaría el CUIT y el
   * punto de venta a todas las que no tienen config propia. Es el peor caso posible de
   * este módulo: un comprobante emitido con el CUIT de otro titular no se deshace.
   */
  const saved = await settings.upsertSiteSetting({
    namespace: FISCAL_CONFIG_NAMESPACE,
    value: config as unknown as Record<string, unknown>,
    siteId: await fiscalSiteOf(req),
    actorId,
  });
  return normalizeFiscalConfig(saved.value);
}

/**
 * Actualiza los datos de la empresa dueña a partir del snapshot (best-effort):
 * razón social + CUIT y metadata fiscal (last_fiscal_sync, last_snapshot_hash,
 * last_fiscal_document, arca_verified).
 */
export async function applyOwnerUpdate(
  req: MedusaRequest,
  ownerType: FiscalOwnerType,
  ownerId: string,
  snapshot: FiscalSnapshot,
  documentId: string,
  snapshotHash: string,
): Promise<void> {
  try {
    const key = ownerType; // 'corporate' | 'company'
    const service = req.scope.resolve(key) as {
      retrieveCorporate?: (id: string) => Promise<{ metadata?: Record<string, unknown> | null }>;
      retrieveCompany?: (id: string) => Promise<{ metadata?: Record<string, unknown> | null }>;
      updateCorporates?: (input: Record<string, unknown>) => Promise<unknown>;
      updateCompanies?: (input: Record<string, unknown>) => Promise<unknown>;
    };
    const retrieve = ownerType === 'corporate' ? service.retrieveCorporate : service.retrieveCompany;
    const update = ownerType === 'corporate' ? service.updateCorporates : service.updateCompanies;
    if (!retrieve || !update) return;

    const owner = await retrieve(ownerId);
    const metadata = {
      ...((owner?.metadata as Record<string, unknown>) ?? {}),
      last_fiscal_sync: snapshot.verified_at,
      last_fiscal_document: documentId,
      last_snapshot_hash: snapshotHash,
      arca_verified: true,
    };
    await update({
      id: ownerId,
      legal_name: snapshot.legal_name,
      tax_id: snapshot.tax_id,
      metadata,
    });
  } catch {
    /* best-effort: nunca romper la generación por esto */
  }
}
