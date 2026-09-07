import { memoNamespace } from '../../lib/settings-cache';
import storeImporterDescriptors from '../app-settings/descriptors/store-importer';
import { resolveEffectiveValue, type AppSettingRow } from '../app-settings/resolve';
import { readEntriesFromBlob } from '../app-settings/site-setting-store';
import { getSnapshotRow } from '../app-settings/snapshot';

/**
 * Configuración efectiva del Importador de catálogo, con la precedencia
 * **DB > env > default** de `app-settings`.
 *
 * Hay DOS entradas, igual que en `kapso-whatsapp/settings.ts`:
 *
 *  - `getStoreImporterSettings()` — SINCRÓNICA, lee del snapshot que el loader de
 *    `app-settings` llena al arrancar. Es el fallback y lo que usa cualquier call
 *    site sin contenedor.
 *
 *  - `loadStoreImporterSettingsViaPg(pg)` — ASÍNCRONA, lee `site_setting` con knex
 *    crudo y memoiza 30 s por namespace. Es la que usa el JOB
 *    (`jobs/process-demo-store-imports.ts`), y acá sí se usa de verdad: el job
 *    recibe el contenedor, así que resolver `PG_CONNECTION` no cuesta nada.
 *
 * POR QUÉ EL JOB VA POR EL CAMINO ASYNC PUDIENDO USAR EL SNAPSHOT: el job corre en
 * el WORKER y el admin escribe en el SERVER (`MEDUSA_WORKER_MODE` levanta dos
 * procesos). El snapshot del worker converge solo por su TTL de 30 s, así que el
 * sync tampoco estaría mal — pero el número que se lee acá decide si se declara
 * MUERTA una importación en curso, y es exactamente el que un operador va a mover
 * mientras mira la pantalla, con una importación grande corriendo. Leer la fila en
 * el momento, en vez de esperar a que venza un snapshot, es la diferencia entre
 * "subí el umbral y dejó de matarme la importación" y "subí el umbral y en el tick
 * siguiente igual me la mató".
 *
 * Las dos comparten el MISMO cálculo (`buildSettings`) y el mismo resolver, así
 * que no hay dos definiciones de precedencia que puedan divergir.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LAS DOS VEN LA CONFIGURACIÓN DE LA INSTANCIA, NUNCA LA DE UNA TIENDA.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Acá eso NO es una limitación heredada como en Kapso: es lo correcto. El
 * namespace es `defaultScope: 'instance'` porque el job barre las importaciones de
 * TODAS las tiendas en una sola pasada — ver la nota de `descriptors/store-importer.ts`.
 *
 * SERVER-ONLY: importa `resolve.ts`, que lee `process.env` y descifra. El bundle
 * del admin importa `descriptors/store-importer`, nunca esto.
 */

export const STORE_IMPORTER_SETTINGS_NAMESPACE = storeImporterDescriptors.namespace;

export type StoreImporterSettings = {
  /**
   * Cuánto puede estar una importación sin registrar avance antes de darla por
   * huérfana de un reinicio. Gobierna DOS cosas a la vez en el job: marcar la
   * vieja como fallida y dejar arrancar una nueva.
   */
  staleMs: number;
};

/** De dónde sale la fila de DB de una key. Es lo único que cambia entre caminos. */
type RowLookup = (key: string) => AppSettingRow | undefined;

const byKey = new Map(storeImporterDescriptors.settings.map((d) => [d.key, d]));

const snapshotLookup: RowLookup = (key) =>
  getSnapshotRow(STORE_IMPORTER_SETTINGS_NAMESPACE, key);

/** 20 minutos. El mismo literal que tenía `process.env.DEMO_IMPORT_STALE_MS ?? …`. */
const DEFAULT_STALE_MS = 20 * 60 * 1000;

function buildSettings(lookup: RowLookup): StoreImporterSettings {
  const read = <T>(key: string, fallback: T): T => {
    const descriptor = byKey.get(key);
    if (!descriptor) return fallback;
    // La entrada se pasa como capa GLOBAL, que es lo que es: sin `resolution`,
    // `resolveEffectiveValue` resuelve como instancia y ni mira la capa de tienda.
    const value = resolveEffectiveValue(descriptor, { global: lookup(key) });
    return (value === undefined || value === null ? fallback : value) as T;
  };

  // Un `NaN` o un valor no positivo acá haría que `now - lastActivity < STALE_MS`
  // sea SIEMPRE falso, o sea que el job barrería como huérfana toda importación
  // viva en el primer tick. `coerceFromEnv` convierte pero no valida rangos —a
  // propósito—, así que la red va acá.
  const staleMs = Number(read<number>('DEMO_IMPORT_STALE_MS', DEFAULT_STALE_MS));

  return {
    staleMs: Number.isFinite(staleMs) && staleMs > 0 ? staleMs : DEFAULT_STALE_MS,
  };
}

/**
 * Camino SINCRÓNICO. Antes de que corra el loader de `app-settings` devuelve lo
 * que hay en `process.env`, o sea que se comporta exactamente como antes de esta
 * migración. Ver la nota de `app-settings/snapshot.ts`.
 */
export function getStoreImporterSettings(): StoreImporterSettings {
  return buildSettings(snapshotLookup);
}

/** Conexión knex mínima que necesita `loadStoreImporterSettingsViaPg`. */
export type PgRawConnection = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[] }>;
};

/**
 * Camino ASÍNCRONO por `PG_CONNECTION`, para el job.
 *
 * Memoiza en `lib/settings-cache.ts` con la clave PELADA del namespace (sin
 * sufijo de scope), que es la que `invalidateNamespace()` borra junto con todos
 * los scopes: la ruta de admin que escribe la llama y con eso también se cae esta
 * cache, sin código extra.
 *
 * Desarma el jsonb con `readEntriesFromBlob`, la misma función que usan el camino
 * async del admin y el loader del snapshot. Tener un segundo parser del sobre
 * sería la forma de que el job y la card discrepen sobre qué está guardado.
 *
 * Si Postgres no responde o la tabla todavía no existe, cae al camino sincrónico
 * en vez de tirar: una config que no se puede leer nunca debe abortar el barrido
 * de importaciones huérfanas.
 */
export async function loadStoreImporterSettingsViaPg(
  pg: PgRawConnection | undefined,
): Promise<StoreImporterSettings> {
  if (!pg) return getStoreImporterSettings();
  try {
    const rows = await memoNamespace(STORE_IMPORTER_SETTINGS_NAMESPACE, async () => {
      const result = await pg.raw(
        `SELECT "value"
           FROM "site_setting"
          WHERE "namespace" = ? AND "site_id" IS NULL AND "deleted_at" IS NULL
          LIMIT 1`,
        [STORE_IMPORTER_SETTINGS_NAMESPACE],
      );
      const blob = (result?.rows ?? [])[0] as { value?: unknown } | undefined;
      return readEntriesFromBlob(blob?.value);
    });
    return buildSettings((key) => rows.get(key));
  } catch {
    return getStoreImporterSettings();
  }
}
