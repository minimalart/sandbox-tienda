import { readForeignSetting } from './foreign';

/**
 * El puente que le da `readForeignSetting` a los PLUGINS.
 *
 * ─── QUÉ PROBLEMA RESUELVE ──────────────────────────────────────────────────
 *
 * `foreign.ts` establece la regla: `envOnly` significa "acá no se EDITA", NO
 * "acá se ignora la base". Todos los lectores de una credencial compartida —
 * `OPENROUTER_API_KEY` la leen catalogador, seo-geo, landing-page y el
 * asistente— tienen que ver el MISMO valor efectivo, o el día que alguien la
 * rota desde el admin la dueña autentica con la nueva y las demás siguen con la
 * vieja.
 *
 * Los plugins de `packages/plugins/*` rompían esa regla, y no por descuido: al
 * migrar de `packages/extensions/` a paquetes npm propios perdieron el acceso a
 * `app-settings/*` (que vive en `apps/backend/src/modules/`) y quedaron con un
 * stub que lee `process.env` a secas. El resultado en desdeelsur (DESDEELSUR-46)
 * fue exacto: la key guardada y cifrada en `site_setting`, `env_present: false`,
 * y el catalogador tirando 503 "OPENROUTER_API_KEY no está configurada" en cada
 * intento de generar textos — mientras el chat del asistente, que sí lee la
 * base, funcionaba perfecto. Un plugin no puede ver una credencial que el
 * operador ya guardó.
 *
 * ─── POR QUÉ `globalThis` Y NO EL CONTENEDOR ────────────────────────────────
 *
 * Sería más limpio que el plugin resolviera un módulo por string, como ya hace
 * con `storeConfig` (`lib/foreign-modules.ts`). No se puede, y está clavado a
 * propósito: el service de `app-settings` es un MARCADOR INERTE y el cartel de
 * `index.ts` dice que no debe tener métodos NUNCA, porque Medusa lo instancia
 * con un contenedor hermético que no conoce `demo_store` — todo método ahí
 * leería una config vacía y caería al entorno sin un solo error en los logs.
 *
 * Y el contenedor tampoco alcanzaría: los call sites que necesitan esto son
 * SINCRÓNICOS y sin request. `apiKey()` se llama dentro de `headers()`, en el
 * medio de un `fetch`; `mergeCatalogadorConfig` corre como merge puro sobre un
 * snapshot congelado. Enhebrar la key desde la ruta hasta ahí pasaría por cinco
 * archivos del pipeline de IA.
 *
 * Así que el puente es una función en `globalThis`, publicada por el loader del
 * módulo — el único hook de Medusa que corre antes del primer request. Es la
 * misma filosofía que `findDescriptor`: dependencia en RUNTIME que degrada sola.
 * Un proyecto generado sin `app-settings` no publica nada y el plugin sigue
 * leyendo `process.env`, o sea el comportamiento previo a la migración.
 *
 * ─── EL CONTRATO ES DELIBERADAMENTE ANGOSTO ─────────────────────────────────
 *
 * Tres parámetros posicionales y un `string` de vuelta: nada de objetos de
 * opciones ni tipos compartidos. El plugin y el host se compilan por separado y
 * no comparten un paquete de tipos, así que todo lo que cruce el puente tiene
 * que ser estructuralmente trivial. La clave lleva `_v1`: el día que el contrato
 * cambie, el nombre cambia y un plugin viejo no ve el puente nuevo — degrada al
 * entorno en vez de recibir algo que no sabe leer.
 *
 * Devuelve `''` para "no configurado", igual que `readForeignSetting`: vacío y
 * ausente son indistinguibles para todos los consumidores de hoy.
 *
 * SERVER-ONLY: importa `foreign.ts`, que descifra y lee `process.env`.
 */

/**
 * Nombre de la función en `globalThis`. Lo tiene que repetir LITERAL cada plugin
 * que consuma el puente (`packages/plugins/<id>/src/lib/host-settings.ts`): es el
 * precio de no tener un paquete compartido, y es la razón del `_v1`.
 */
export const FOREIGN_SETTING_BRIDGE_KEY = '__mercattoForeignSettingReader_v1';

/**
 * `envFallback` es la cadena de variables de entorno a probar cuando el
 * namespace no tiene valor. No se adivina de `key` porque hay cadenas reales
 * (`EMBEDDINGS_API_KEY` cae a `OPENROUTER_API_KEY`) y la decide quien llama.
 */
export type ForeignSettingReader = (
  namespace: string,
  key: string,
  envFallback?: string[],
) => string;

const defaultReader: ForeignSettingReader = (namespace, key, envFallback) =>
  readForeignSetting(namespace, key, envFallback ? { envFallback } : {});

/**
 * Publica el puente. Idempotente: el loader puede correr más de una vez (varias
 * réplicas, un reload en dev) y sobreescribir con la misma función no rompe nada.
 *
 * No lee nada al publicarse — el lector consulta el snapshot en cada llamada, así
 * que una key rotada después del arranque se ve sin reiniciar (el snapshot tiene
 * su propio TTL con revalidación).
 */
export function publishForeignSettingBridge(reader: ForeignSettingReader = defaultReader): void {
  (globalThis as unknown as Record<string, unknown>)[FOREIGN_SETTING_BRIDGE_KEY] = reader;
}

/** Sólo para tests: deja `globalThis` como estaba. */
export function __unpublishForeignSettingBridge(): void {
  delete (globalThis as unknown as Record<string, unknown>)[FOREIGN_SETTING_BRIDGE_KEY];
}
