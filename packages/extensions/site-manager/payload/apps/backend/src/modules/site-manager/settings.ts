import siteManagerDescriptors from '../app-settings/descriptors/site-manager';
import { resolveSettingSync } from '../app-settings/resolve';

/**
 * Conexión efectiva con Mercatto Platform, con la precedencia
 * **DB > env > default** de `app-settings`.
 *
 * Sincrónica y calcada de `modules/typesense/settings.ts`. Acá los tres call
 * sites SÍ tienen contenedor (son rutas de admin), pero se mantiene el camino
 * sync por dos razones: es una función pura y testeable sin DB, y deja las rutas
 * exactamente igual de simples que antes — sin un `await` extra ni un resolve
 * del módulo en cada request. Lee del snapshot que el loader de `app-settings`
 * llena al arrancar; hasta entonces cae a `process.env`, o sea que se comporta
 * como antes de esta migración.
 */

export type PlatformConnection = {
  /** URL base sin barra final, o `null` si no está configurada. */
  platformUrl: string | null;
  projectId: string | null;
  projectSecret: string | null;
  /**
   * `true` sólo con las TRES presentes. Las rutas usan esto y no cada campo por
   * separado: una conexión a medias no sirve para nada y antes de esta migración
   * ya se evaluaba así, con el mismo `Boolean(a && b && c)` repetido en tres
   * archivos.
   */
  configured: boolean;
};

/** Conexión ya validada, para el camino feliz de las rutas que sí llaman. */
export type ConfiguredPlatformConnection = {
  platformUrl: string;
  projectId: string;
  projectSecret: string;
};

const byKey = new Map(siteManagerDescriptors.settings.map((d) => [d.key, d]));

function read(key: string): string | null {
  const descriptor = byKey.get(key);
  if (!descriptor) return null;
  const value = resolveSettingSync(descriptor);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function getPlatformConnection(): PlatformConnection {
  // La barra final se recorta acá y no en cada ruta: los tres call sites la
  // recortaban por su cuenta y uno de ellos (extensions/route.ts) se olvidaba,
  // así que la misma instalación reportaba dos URLs distintas según el endpoint.
  const platformUrl = read('MERCATTO_PLATFORM_URL')?.replace(/\/+$/, '') ?? null;
  const projectId = read('MERCATTO_PROJECT_ID');
  const projectSecret = read('MERCATTO_PROJECT_SECRET');
  return {
    platformUrl,
    projectId,
    projectSecret,
    configured: Boolean(platformUrl && projectId && projectSecret),
  };
}

/** La conexión sólo si está completa, o `null`. Evita el chequeo triple. */
export function getConfiguredPlatformConnection(): ConfiguredPlatformConnection | null {
  const { platformUrl, projectId, projectSecret } = getPlatformConnection();
  if (!platformUrl || !projectId || !projectSecret) return null;
  return { platformUrl, projectId, projectSecret };
}

/** Headers de autenticación contra la plataforma. */
export function platformAuthHeaders(connection: ConfiguredPlatformConnection): Record<string, string> {
  return {
    'x-mercatto-project-id': connection.projectId,
    'x-mercatto-project-secret': connection.projectSecret,
  };
}
