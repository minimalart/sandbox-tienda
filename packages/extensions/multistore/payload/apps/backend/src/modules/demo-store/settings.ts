import multistoreDescriptors from '../app-settings/descriptors/multistore';
import { resolveSettingSync } from '../app-settings/resolve';

/**
 * Configuración efectiva de Multitienda que vive en `site_setting`, con la
 * precedencia **DB > env > default** de `app-settings`.
 *
 * ─── POR QUÉ ES SÓLO SINCRÓNICA (a diferencia de `kapso-whatsapp/settings.ts`) ─
 *
 * Los dos únicos consumidores son `throttle()` y `backoffMs()` en
 * `catalog/util.ts`, que están DENTRO de `resilientFetch`: un helper de red que
 * los importadores llaman en cada página del catálogo de origen. No recibe el
 * contenedor y no tiene de dónde sacarlo — está seis niveles abajo del job que
 * inició la importación, detrás de una API (`fetchJson(url)`) que existe para no
 * saber nada de Medusa. Meterle un parámetro `container` a esa cadena para leer
 * dos números sería pagar un refactor grande por nada.
 *
 * Así que no hay camino `loadViaPg`: no habría quién lo llame, y una función
 * exportada que nadie usa es la próxima que alguien copia sin entender. Mismo
 * criterio que `typesense/settings.ts` y `catalogador/settings.ts`.
 *
 * ─── Y POR QUÉ EL SNAPSHOT ALCANZA IGUAL ─────────────────────────────────────
 *
 * La importación corre en el WORKER, no en el server, y el admin escribe en el
 * server. Eso, que en Kapso obligó al camino por `PG_CONNECTION`, acá no duele:
 * `app-settings/snapshot.ts` hace *stale-while-revalidate* con TTL de 30 s, así
 * que el worker converge solo. En el peor caso, subir el throttle desde la card
 * tarda medio minuto en verse en la importación en curso — que sigue siendo
 * infinitamente mejor que el `.env` + redeploy que había antes, y que además
 * mataba la importación que se estaba tratando de salvar.
 *
 * Antes de que el loader llene el snapshot se cae a `process.env`, o sea que se
 * comporta exactamente como antes de esta migración.
 *
 * ─── POR QUÉ `MULTISTORE_PUBLIC_BASE_URL` NO ESTÁ ACÁ ────────────────────────
 *
 * El namespace tiene una tercera clave —la base pública del storefront— y este
 * lector no la expone a propósito: su único consumidor es
 * `api/admin/store-config/storefront-url/route.ts`, que es de OTRA extensión y la
 * lee con `readForeignSetting('extension:multistore', …)`. Ese camino existe
 * justamente para que un lector ajeno no tenga que importar el módulo del dueño y
 * pueda degradar solo si Multitienda no está instalada. Agregarla acá sería un
 * campo que nadie llama, o —peor— la invitación a que el route importe este
 * archivo y se lleve puesto el contrato de `foreign.ts`.
 *
 * SERVER-ONLY: importa `resolve.ts`, que lee `process.env` y descifra. El bundle
 * del admin importa `descriptors/multistore`, nunca esto.
 */

export const MULTISTORE_SETTINGS_NAMESPACE = multistoreDescriptors.namespace;

export type MultistoreSettings = {
  /** Separación mínima entre requests salientes del importador. 0 = sin throttle. */
  importThrottleMs: number;
  /** Base del backoff exponencial entre reintentos, cuando no hay `Retry-After`. */
  importBackoffBaseMs: number;
};

const byKey = new Map(multistoreDescriptors.settings.map((d) => [d.key, d]));

function read<T>(key: string, fallback: T): T {
  const descriptor = byKey.get(key);
  if (!descriptor) return fallback;
  const value = resolveSettingSync(descriptor);
  return (value === undefined || value === null ? fallback : value) as T;
}

/**
 * Igual que `read` pero exigiendo un número finito y no negativo.
 *
 * No es paranoia de tipos: el valor puede venir de una env var que nadie validó
 * —`coerceFromEnv` convierte pero NO valida rangos, a propósito— y un `NaN` o un
 * negativo acá se traducen en `sleep(NaN)` o en un backoff que no espera nada y
 * martilla a la fuente hasta que corta. El default vale más que un valor roto.
 */
function readMs(key: string, fallback: number): number {
  const value = Number(read<number>(key, fallback));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function getMultistoreSettings(): MultistoreSettings {
  return {
    importThrottleMs: readMs('DEMO_IMPORT_THROTTLE_MS', 200),
    importBackoffBaseMs: readMs('DEMO_IMPORT_BACKOFF_BASE_MS', 1000),
  };
}
