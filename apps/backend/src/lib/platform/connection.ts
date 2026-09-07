/**
 * Conexión de esta INSTANCIA con Mercatto Platform.
 *
 * Vive en `lib/` —CORE— por lo mismo que `project-metadata.ts`: las rutas que la usan
 * (`api/admin/platform/{catalog,extensions,change-requests}`) son core y no pueden
 * depender de una extensión desinstalable. Nació en `site-manager`, que se eliminó.
 *
 * Lee `process.env` DIRECTO, sin pasar por `app-settings`, y es deliberado:
 * `MERCATTO_PLATFORM_URL`, `MERCATTO_PROJECT_ID` y `MERCATTO_PROJECT_SECRET` son de
 * la instancia, NO del site (EXTENSIONES-MULTITIENDA.md, decisión 7 — "por eso los
 * change-requests van a core"). Resolverlas por site no significaría nada: hay una
 * sola plataforma por backend, y meterlas en la tabla de settings las volvería
 * escribibles desde el backoffice de cualquier tienda.
 *
 * El valor de tenerlas acá y no sueltas en cada ruta son las dos invariantes que
 * antes cada archivo repetía por su cuenta —y una se olvidaba:
 *
 *  1. La barra final se recorta en UN solo lugar. `catalog/route.ts` la recortaba,
 *     `extensions/route.ts` la devolvía cruda: la misma instalación reportaba dos
 *     URLs distintas según a qué endpoint le preguntaras.
 *  2. `configured` es un solo booleano. El `Boolean(a && b && c)` estaba escrito tres
 *     veces; una conexión a medias no sirve para nada.
 */

export type PlatformConnection = {
  /** URL base sin barra final, o `null` si no está configurada. */
  platformUrl: string | null;
  projectId: string | null;
  projectSecret: string | null;
  /**
   * `true` sólo con las TRES presentes. Las rutas usan esto y no cada campo por
   * separado.
   */
  configured: boolean;
};

/** Conexión ya validada, para el camino feliz de las rutas que sí llaman. */
export type ConfiguredPlatformConnection = {
  platformUrl: string;
  projectId: string;
  projectSecret: string;
};

/** El env es un parámetro sólo para poder testear sin ensuciar `process.env`. */
type Env = Record<string, string | undefined>;

/**
 * Un env var seteado en vacío (`MERCATTO_PROJECT_ID=`) cuenta como AUSENTE: es lo que
 * queda en un `.env` con la línea a medio completar o en un panel de deploy donde
 * borraron el valor pero no la variable, y tratarlo como presente haría pasar
 * `configured` con una credencial que la plataforma va a rechazar.
 */
function read(env: Env, key: string): string | null {
  const value = env[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function getPlatformConnection(env: Env = process.env): PlatformConnection {
  // `/+$` y no `/$`: una URL pegada con una barra de más (`.../` + `/`) tiene que
  // quedar igual de normalizada, si no vuelve el mismo problema con `//v1/catalog`.
  const platformUrl = read(env, 'MERCATTO_PLATFORM_URL')?.replace(/\/+$/, '') ?? null;
  const projectId = read(env, 'MERCATTO_PROJECT_ID');
  const projectSecret = read(env, 'MERCATTO_PROJECT_SECRET');
  return {
    platformUrl,
    projectId,
    projectSecret,
    configured: Boolean(platformUrl && projectId && projectSecret),
  };
}

/** La conexión sólo si está completa, o `null`. Evita el chequeo triple. */
export function getConfiguredPlatformConnection(env: Env = process.env): ConfiguredPlatformConnection | null {
  const { platformUrl, projectId, projectSecret } = getPlatformConnection(env);
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
