import { findDescriptor } from './descriptors';
import { resolveSettingSync } from './resolve';

/**
 * Lectura de un ajuste que es de OTRO namespace.
 *
 * ─── QUÉ PROBLEMA RESUELVE ──────────────────────────────────────────────────
 *
 * Hay un puñado de variables que leen tres, cuatro y hasta cinco extensiones a la
 * vez: `OPENROUTER_API_KEY`, `OPENROUTER_SITE_URL`, `EMBEDDINGS_*`, `CHAT_AI_*`.
 * La regla de propiedad dice que la EDITA UN SOLO namespace —el que la entiende
 * mejor— y que los demás la declaran en `envOnly` nombrándolo. Pero declararla
 * `envOnly` y después leer `process.env` a mano deja el sistema PEOR que antes:
 * el dueño lee la fila de la base y los otros siguen leyendo el entorno, así que
 * el día que alguien rota la key desde el admin, la extensión dueña empieza a
 * autenticar con la nueva y las otras tres siguen con la vieja. Falla con un 401
 * en la mitad del producto y sin ninguna pista de por qué.
 *
 * Esta función es la otra mitad de la regla: `envOnly` significa "acá no se
 * EDITA", no "acá se ignora la base". Todos leen el mismo valor efectivo.
 *
 * ─── POR QUÉ ES UNA BÚSQUEDA POR DATO Y NO UN IMPORT ────────────────────────
 *
 * Lo obvio sería que `modules/landing-page` importara
 * `descriptors/ai-assistant.ts` directo. No se puede, y no es un detalle de
 * estilo: `descriptors/index.ts` lo REGENERA el composer con las extensiones que
 * el cliente eligió. Un proyecto con el generador de landings y sin el Asistente
 * IA no tiene ese archivo, y el import rompería el build entero de una extensión
 * por una dependencia opcional.
 *
 * Yendo por `findDescriptor(namespace, key)` la dependencia es en runtime y
 * degrada sola: si el dueño no está instalado devuelve `null`, y el lector cae a
 * `process.env` — o sea, exactamente el comportamiento previo a la migración.
 *
 * ─── LÍMITES ────────────────────────────────────────────────────────────────
 *
 * Es SINCRÓNICA y por lo tanto ve sólo la fila GLOBAL: el mismo techo que
 * `resolveSettingSync`, por el mismo motivo (los call sites son clientes HTTP sin
 * request). No lo esconde: si el dueño declara el descriptor `scope: 'instance'`
 * —que es lo correcto para una credencial compartida— no se pierde nada.
 *
 * SERVER-ONLY: importa `resolve.ts`, que lee `process.env` y descifra.
 */

/** Cómo leer el entorno. Inyectable para los tests; en producción es `process.env`. */
type EnvRead = (name: string) => string | undefined;

const defaultEnvRead: EnvRead = (name) => process.env[name];

/**
 * Valor efectivo de `key` en `namespace`, o el `process.env` de respaldo cuando
 * ese namespace no está instalado en este proyecto.
 *
 * Devuelve string SIEMPRE (`''` cuando no hay nada), porque los cuatro call sites
 * de hoy hacían `process.env.X?.trim() || fallback` y el contrato tiene que
 * seguir siendo el mismo: "vacío" y "no configurado" son indistinguibles.
 *
 * `envFallback` no se adivina de la key a propósito: hay lecturas encadenadas
 * reales (`EMBEDDINGS_API_KEY` cae a `OPENROUTER_API_KEY`) y la cadena la decide
 * el que llama, no esta función.
 */
export function readForeignSetting(
  namespace: string,
  key: string,
  options: { envFallback?: string[]; envRead?: EnvRead } = {},
): string {
  const envRead = options.envRead ?? defaultEnvRead;

  const descriptor = findDescriptor(namespace, key);
  if (descriptor) {
    const value = resolveSettingSync(descriptor);
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    // `undefined`/`null`/`''` = el dueño no tiene valor. Se sigue de largo hacia
    // el entorno igual que si el namespace no existiera: el descriptor puede
    // estar declarado y sin fila ni default (es el caso de los secretos).
  }

  for (const name of options.envFallback ?? [key]) {
    const raw = envRead(name);
    if (raw !== undefined && raw.trim() !== '') return raw.trim();
  }
  return '';
}

/** Igual que la anterior, pero para un descriptor `type: 'number'`. */
export function readForeignNumber(
  namespace: string,
  key: string,
  fallback: number,
  options: { envFallback?: string[]; envRead?: EnvRead } = {},
): number {
  const raw = readForeignSetting(namespace, key, options);
  if (raw === '') return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Namespace del Asistente IA como CONSTANTE de string, no como import del
 * descriptor: si esto fuera `aiAssistantDescriptors.namespace`, el import
 * estático volvería a atar a las extensiones que sólo LEEN con la que edita, que
 * es justo lo que este archivo existe para evitar.
 */
export const AI_ASSISTANT_SETTINGS_NAMESPACE = 'extension:ai-assistant';
