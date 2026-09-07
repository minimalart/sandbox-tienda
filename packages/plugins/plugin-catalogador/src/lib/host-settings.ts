/**
 * Lectura de ajustes que son del HOST, desde el plugin.
 *
 * ─── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
 *
 * Al migrar de `packages/extensions/catalogador` a paquete npm, el plugin perdió
 * el acceso a `app-settings/*` (vive en `apps/backend/src/modules/`) y los dos
 * lectores de credenciales quedaron con un stub de `process.env` a secas
 * — `ai/openrouter.ts` y `modules/catalogador/settings.ts`, cada uno con su
 * nota diciendo que había que volver a `DB > env > default` cuando hubiera cómo.
 *
 * El costo de esa deuda no fue teórico. En desdeelsur (DESDEELSUR-46) la
 * `OPENROUTER_API_KEY` estaba guardada y cifrada en `site_setting` desde el
 * 19/08 y NO estaba en el entorno (`env_present: false`). El asistente de IA
 * —que lee la base— andaba; el catalogador contestaba 503 "OPENROUTER_API_KEY no
 * está configurada en el backend" en cada intento de generar textos. Seis
 * corridas creadas en nueve minutos, ninguna llegó a arrancar.
 *
 * Y no era una omisión del operador: `descriptors/catalogador.ts` declara esa
 * key como `envOnly` porque la EDITA el namespace del asistente, y el cartel de
 * `app-settings/foreign.ts` es explícito — "`envOnly` significa 'acá no se
 * EDITA', no 'acá se ignora la base'". El plugin estaba del lado equivocado de
 * esa regla.
 *
 * ─── CÓMO ───────────────────────────────────────────────────────────────────
 *
 * El host publica un lector en `globalThis` desde el loader de `app-settings`
 * (`plugin-bridge.ts`). Acá se lo busca por su nombre literal en cada llamada.
 * Si no está —proyecto generado sin `app-settings`, o el loader todavía no
 * corrió— se cae al entorno, que es exactamente el comportamiento anterior.
 *
 * Se busca en CADA llamada y no se memoiza el resultado: el puente puede
 * aparecer después del primer import (el orden entre loaders de módulos y la
 * carga de este archivo no está garantizado), y cachear un `null` de arranque
 * dejaría el plugin leyendo el entorno para todo el proceso — que es justo el
 * bug que este archivo viene a cerrar.
 *
 * SERVER-ONLY: el bundle del admin nunca importa esto.
 */

/**
 * El nombre del puente, LITERAL. Tiene que coincidir con
 * `FOREIGN_SETTING_BRIDGE_KEY` de `apps/backend/src/modules/app-settings/plugin-bridge.ts`.
 *
 * Repetir el string es deliberado: importarlo acoplaría el bundle del plugin al
 * árbol del host, que es lo que la migración vino a romper. El sufijo `_v1` es la
 * red: si el contrato cambia, cambia el nombre y un plugin viejo no ve el puente
 * nuevo — degrada al entorno en vez de recibir algo que no sabe leer.
 */
const FOREIGN_SETTING_BRIDGE_KEY = '__mercattoForeignSettingReader_v1';

type ForeignSettingReader = (namespace: string, key: string, envFallback?: string[]) => string;

function hostReader(): ForeignSettingReader | null {
  const candidate = (globalThis as unknown as Record<string, unknown>)[FOREIGN_SETTING_BRIDGE_KEY];
  return typeof candidate === 'function' ? (candidate as ForeignSettingReader) : null;
}

/** Un valor con espacios de más se comporta como vacío, no como una URL rota. */
function fromEnv(names: string[]): string {
  for (const name of names) {
    const raw = process.env[name];
    if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
  }
  return '';
}

/**
 * Valor efectivo de `key` en `namespace`: base del host si el puente está, y si
 * no el entorno.
 *
 * Devuelve `''` SIEMPRE que no haya nada, igual que la versión del host: los call
 * sites de hoy hacían `process.env.X?.trim() || fallback` y el contrato tiene que
 * seguir siendo el mismo — "vacío" y "no configurado" son indistinguibles.
 *
 * El fallback al entorno se aplica también cuando el puente contesta vacío o
 * tira. Es redundante con la lógica del host (que ya cae al entorno solo), y lo
 * es a propósito: un puente de una versión que no conozca `envFallback`, o que
 * explote por un descifrado roto, no puede dejar al plugin sin la variable que
 * el entorno sí tenía.
 */
export function readForeignSetting(
  namespace: string,
  key: string,
  envFallback: string[] = [key],
): string {
  const read = hostReader();
  if (read) {
    try {
      const value = read(namespace, key, envFallback);
      if (typeof value === 'string' && value.trim() !== '') return value.trim();
    } catch {
      // El puente no puede ser un modo de falla nuevo: se sigue al entorno.
    }
  }
  return fromEnv(envFallback);
}

/**
 * Namespace del Asistente IA como CONSTANTE, no como import: es el dueño de las
 * credenciales de OpenRouter (`descriptors/ai-assistant.ts`), y el catalogador
 * sólo las LEE. Mismo criterio que `AI_ASSISTANT_SETTINGS_NAMESPACE` en el host.
 */
export const AI_ASSISTANT_SETTINGS_NAMESPACE = 'extension:ai-assistant';

/** Namespace propio del Catalogador (`descriptors/catalogador.ts`). */
export const CATALOGADOR_SETTINGS_NAMESPACE = 'extension:catalogador';
