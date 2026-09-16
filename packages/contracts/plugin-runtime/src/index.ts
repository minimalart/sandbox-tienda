/**
 * Runtime coordination contract entre el host de Mercatto y los plugins.
 *
 * Este package NO tiene lógica de negocio — es un rendez-vous a nivel proceso.
 * Host y plugins comparten un registro en globalThis, identificado por Symbol.for.
 * No depende del hoisting: npm/pnpm pueden instalar varias copias físicas.
 *
 * ─── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
 *
 * Un plugin publicado no puede importar directamente de `apps/backend/src/...`.
 * Cuando la extensión vivía in-tree, la resolución de settings era un `import`
 * relativo al host. Ahora que el plugin vive en `node_modules`, ese import no
 * cruza el límite del package.
 *
 * Vendorizar el módulo `app-settings` DENTRO del plugin no sirve: los
 * singletons de snapshot son a nivel módulo, dos copias son dos snapshots
 * distintos (ver la nota en `snapshot.ts` del host).
 *
 * Este contract expone SETTERS que el host llama en boot y GETTERS que los
 * plugins llaman en runtime. Las copias compatibles comparten el registro en
 * el mismo contexto de JavaScript. Cada worker/proceso registra sus lectores.
 *
 * ─── QUIÉN LLAMA A QUIÉN ────────────────────────────────────────────────────
 *
 *   HOST (bridge en apps/backend/src/loaders/*.ts)
 *     └─ register* al arrancar
 *
 *   PLUGINS
 *     └─ get* al momento de leer una config
 *
 * Cuando el host no registra —proyecto sin `app-settings`, tests, boot antes
 * de que el bridge corra— los getters devuelven `null` y los plugins caen a
 * sus defaults (típicamente `process.env`).
 */

// ─────────────────────────────────────────────────────────────────────────────
//  App-settings sync reader
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signature del lector sincrónico del snapshot de `app-settings`.
 *
 * El plugin pasa el `namespace` de su descriptor (`'extension:abandoned-cart'`,
 * `'extension:ai-assistant'`, etc.) y una `key` (`'ABANDONED_CART_STEP1_HOURS'`),
 * y recibe el valor efectivo ya coerceado por el descriptor del host (o
 * `undefined` si no hay override en base y hay que caer al env).
 *
 * Es SINCRÓNICO a propósito: los call sites típicos (jobs, workflow steps,
 * request handlers) no quieren pagar el costo de un await por configuración
 * que ya vive en memoria. El snapshot se refresca en background cada
 * `APP_SETTINGS_TTL_MS`; no hay `SELECT` por lectura.
 */
export type AppSettingsSyncReader = (namespace: string, key: string) => unknown;

type UnknownReader = () => unknown;
type SettingsRegistry = {
  appSettingsReader: AppSettingsSyncReader | null;
  externalReaders: Map<string, UnknownReader>;
};

// Versionar el CONTRATO, no la versión npm: las copias compatibles deben
// encontrarse aunque tengan paths o versiones de patch diferentes.
const registryKey = Symbol.for('mercatto.plugin-runtime.settings.v1');
const shared = globalThis as typeof globalThis & { [registryKey]?: SettingsRegistry };
const registry = shared[registryKey] ??= {
  appSettingsReader: null,
  externalReaders: new Map<string, UnknownReader>(),
};

/**
 * El host llama esto UNA VEZ en boot con su propio `resolveSettingSync`
 * (típicamente envuelto para tomar `(namespace, key)`).
 *
 * Pasar `null` desconecta el reader — útil en tests que quieren verificar el
 * comportamiento del plugin sin snapshot.
 */
export function registerAppSettingsSyncReader(fn: AppSettingsSyncReader | null): void {
  registry.appSettingsReader = fn;
}

/**
 * Los plugins llaman esto por cada lectura. Devuelve `null` si el host no
 * registró un reader: el plugin cae a `process.env` con esa señal.
 */
export function getAppSettingsSyncReader(): AppSettingsSyncReader | null {
  return registry.appSettingsReader;
}

// ─────────────────────────────────────────────────────────────────────────────
//  External module readers (genéricos, por key)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registry genérico para módulos del host que un plugin quiere leer sin
 * importarlos. Ej: `kapso-whatsapp/settings`, `email/branding`, cualquier
 * módulo del host que exponga getters sincrónicos.
 *
 * A diferencia de `AppSettingsSyncReader` (que es UN reader con firma
 * conocida), acá cada key trae su propia shape. El plugin declara el tipo que
 * espera y el host lo cablea con esa forma.
 *
 * ─── CONTRATO DE NOMENCLATURA ──────────────────────────────────────────────
 *
 * Las keys son strings kebab-case que describen el módulo del host:
 *   'kapso-whatsapp/settings'
 *   'email/branding'
 *   'store-config/site'
 *
 * Es responsabilidad del que introduce una key documentarla acá — un tipo
 * suelto sin key registrada es un TypeError silencioso el día que dos plugins
 * lo lean con shapes distintos.
 */

/**
 * El host registra un getter para una key del registry. La firma pasa por
 * `unknown` en el registry para no forzar un tipo compartido — cada consumer
 * asserta el tipo que espera y ES SU RESPONSABILIDAD que coincida con lo que
 * el host publicó.
 *
 * Si dos módulos registran la misma key, el último gana (comportamiento
 * intencional: el host puede sobreescribir un reader default con uno propio).
 */
export function registerExternalReader<T>(key: string, reader: () => T | null): void {
  registry.externalReaders.set(key, reader);
}

/**
 * El plugin resuelve el reader por key. Devuelve `null` si nadie registró
 * — no lanza. El plugin decide qué hacer con la ausencia (default, env,
 * feature off, log warning).
 */
export function getExternalReader<T>(key: string): (() => T | null) | null {
  const reader = registry.externalReaders.get(key);
  return reader ? (reader as () => T | null) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Well-known keys del registry externo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Constantes bien conocidas del registry. Documentar acá cualquier nueva key
 * que se agregue — es el índice compartido entre host y plugin.
 *
 * `KAPSO_WHATSAPP_SETTINGS` devuelve la shape completa de
 * `apps/backend/src/modules/kapso-whatsapp/settings.ts::getKapsoSettings()`.
 * Los plugins que la lean deben tolerar cambios de shape (mikro-versionar el
 * tipo si hace falta).
 */
export const EXTERNAL_KEYS = {
  /** Getter returning the host's scoped (namespace, pg, resolution) settings reader. */
  APP_SETTINGS_VIA_PG: 'app-settings/via-pg',
  KAPSO_WHATSAPP_SETTINGS: 'kapso-whatsapp/settings',
} as const;

export { registerCartValidation } from './cart-validation.js';
