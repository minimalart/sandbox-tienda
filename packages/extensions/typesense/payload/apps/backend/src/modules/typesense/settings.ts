import typesenseDescriptors from '../app-settings/descriptors/typesense';
import { resolveSettingSync } from '../app-settings/resolve';

/**
 * Configuración efectiva de Typesense, con la precedencia
 * **DB > env > default** de `app-settings`.
 *
 * Es SINCRÓNICA porque `TypeSenseService` se instancia con `new` en 35 lugares,
 * no extiende `MedusaService` y no tiene contenedor. Lee del snapshot que el
 * loader de `app-settings` llena al arrancar; hasta entonces cae a
 * `process.env`, o sea que se comporta exactamente como antes de esta
 * migración. Ver la nota de `app-settings/snapshot.ts`.
 */

export type TypesenseSettings = {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  apiKey: string;
  analyticsApiKey: string;
  collectionName: string;
  analyticsCollection: string;
  reconcileEnabled: boolean;
  syncLogRetentionDays: number;
};

const byKey = new Map(typesenseDescriptors.settings.map((d) => [d.key, d]));

function read<T>(key: string, fallback: T): T {
  const descriptor = byKey.get(key);
  if (!descriptor) return fallback;
  const value = resolveSettingSync(descriptor);
  return (value === undefined || value === null ? fallback : value) as T;
}

export function getTypesenseSettings(): TypesenseSettings {
  const protocol = read<string>('TYPESENSE_PROTOCOL', 'http');
  return {
    host: read('TYPESENSE_HOST', 'localhost'),
    port: read('TYPESENSE_PORT', 8109),
    protocol: protocol === 'https' ? 'https' : 'http',
    apiKey: read('TYPESENSE_API_KEY', ''),
    analyticsApiKey: read('TYPESENSE_ANALYTICS_API_KEY', ''),
    collectionName: read('TYPESENSE_COLLECTION_NAME', 'products'),
    analyticsCollection: read('TYPESENSE_ANALYTICS_COLLECTION', 'popular_queries'),
    reconcileEnabled: read('TYPESENSE_RECONCILE_ENABLED', true),
    syncLogRetentionDays: read('TYPESENSE_SYNC_LOG_RETENTION_DAYS', 30),
  };
}

/**
 * Los dos mapas `{ site_id: colección }`, en crudo tal como salieron de la
 * precedencia: pueden ser un objeto (fila de `site_setting`, o env ya parseada por
 * `coerceFromEnv`, que para `type: 'json'` hace `JSON.parse`) o `undefined`.
 *
 * Devuelve el valor SIN normalizar a propósito: el único normalizador es
 * `site-collection.ts:parseSiteCollections`, y tener un segundo acá sería la forma
 * de que la búsqueda y la analítica discrepen sobre qué entrada del mapa es válida.
 *
 * Está separada de `getTypesenseSettings()` porque no es configuración del CLIENTE:
 * no entra en `connectionFingerprint` y no tiene por qué reconstruir nada al
 * cambiar. Cambiar el mapa cambia a qué colección se le pega, no con qué conexión.
 */
export type SiteCollectionsSetting =
  | 'TYPESENSE_SITE_COLLECTIONS'
  | 'TYPESENSE_SITE_ANALYTICS_COLLECTIONS';

export function readSiteCollectionsSetting(key: SiteCollectionsSetting): unknown {
  const descriptor = byKey.get(key);
  if (!descriptor) return undefined;
  return resolveSettingSync(descriptor);
}

/**
 * Huella de lo que afecta al CLIENTE de Typesense (no a la colección ni al
 * mantenimiento). El cliente vive en un `static` de proceso y cachea conexión,
 * así que se reconstruye sólo cuando esta huella cambia — no por tiempo.
 */
export function connectionFingerprint(s: TypesenseSettings): string {
  return [s.host, s.port, s.protocol, s.apiKey, s.analyticsApiKey].join('|');
}
