import type { AppSettingRow } from './resolve';

/**
 * Snapshot de la configuración de INSTANCIA, legible SINCRÓNICAMENTE.
 *
 * Guarda las entradas de las filas GLOBALES de `site_setting` (`site_id IS
 * NULL`), nunca las de una tienda. No es una simplificación: quien lee de acá no
 * tiene request, así que no hay tienda que elegir, y mezclar acá los jsonb de
 * varias tiendas haría que la última cargada le ganara a todas en el proceso
 * entero. El cartel largo está en `resolve.ts:resolveSettingSync`.
 *
 * Existe por un problema concreto: hay consumidores de configuración que corren
 * en un constructor sin contenedor y sin poder esperar una promesa. El caso
 * testigo es `TypeSenseService`, que se instancia con `new` en 35 lugares, no
 * extiende `MedusaService` y cachea su cliente en un `static` de proceso
 * (`typesense/service.ts:110`).
 *
 * Para esos casos, `resolveSetting()` (async) no sirve. El snapshot se llena una
 * vez al arrancar — por el loader del módulo, que sí recibe `PG_CONNECTION` —
 * y se refresca en cada escritura del admin. Un consumidor sincrónico lee de
 * acá; si todavía no se llenó, cae a `process.env`, que es el fallback
 * documentado del sistema.
 *
 * Ventana de inconsistencia: entre que arranca el proceso y que corre el loader,
 * un consumidor sincrónico ve el env. En la práctica el loader corre antes del
 * primer request, así que la ventana es teórica — pero es real y por eso está
 * escrita acá en vez de asumida.
 *
 * Deliberadamente separado de `settings-cache.ts`: aquél es un memo con TTL para
 * el camino async, éste es un espejo completo sin expiración para el camino
 * sync. Mezclarlos daría un memo que a veces expira bajo los pies de un
 * constructor.
 */

type NamespaceRows = Map<string, AppSettingRow>;

let snapshot = new Map<string, NamespaceRows>();
let ready = false;
let loadedAt = 0;
let refreshing = false;

/** Reloj inyectable, para testear el vencimiento sin esperar. */
let now = (): number => Date.now();

/**
 * Recarga completa del snapshot. La registra el loader al arrancar, cerrando
 * sobre la conexión de Postgres que le inyectó el contenedor. Sin esto el
 * snapshot sólo se llenaría una vez por proceso.
 */
type Refresher = () => Promise<void>;
let refresher: Refresher | null = null;

/**
 * Vencimiento del snapshot. Mismo valor que el memo async, por la misma razón:
 * es el desfase máximo aceptable para configuración.
 */
export const SNAPSHOT_TTL_MS = Math.max(1000, Number(process.env.APP_SETTINGS_TTL_MS) || 30_000);

export const registerSnapshotRefresher = (fn: Refresher): void => {
  refresher = fn;
};

/** `true` una vez que el snapshot se llenó al menos una vez. */
export const isSnapshotReady = (): boolean => ready;

/**
 * Dispara una recarga en segundo plano si el snapshot venció.
 *
 * Es *stale-while-revalidate*: el lector sincrónico devuelve lo que hay —no
 * puede esperar una promesa— y la próxima lectura ya ve lo nuevo. Sin esto, con
 * N réplicas, guardar desde el admin actualizaba SÓLO el proceso que escribió y
 * las otras N-1 se quedaban con el valor viejo hasta el próximo reinicio: el
 * camino async tenía TTL y el sincrónico no.
 *
 * El flag `refreshing` evita que N lecturas concurrentes disparen N queries. Los
 * errores se tragan a propósito: un Postgres que parpadea deja el snapshot
 * viejo, que es mejor que romper el camino de lectura de configuración.
 */
function revalidateIfStale(): void {
  if (!refresher || refreshing || !ready) return;
  if (now() - loadedAt < SNAPSHOT_TTL_MS) return;

  refreshing = true;
  try {
    void refresher()
      .catch(() => undefined)
      .finally(() => {
        refreshing = false;
      });
  } catch {
    refreshing = false;
  }
}

/** Fila del snapshot, o `undefined` si no está (o si todavía no se llenó). */
export const getSnapshotRow = (namespace: string, key: string): AppSettingRow | undefined => {
  revalidateIfStale();
  return snapshot.get(namespace)?.get(key);
};

/** Reemplaza el snapshot COMPLETO. La usa el loader de arranque. */
export function replaceSnapshot(rows: AppSettingRow[] & { namespace?: string }[]): void {
  const next = new Map<string, NamespaceRows>();
  for (const row of rows as (AppSettingRow & { namespace: string })[]) {
    const bucket = next.get(row.namespace) ?? new Map<string, AppSettingRow>();
    bucket.set(row.key, row);
    next.set(row.namespace, bucket);
  }
  snapshot = next;
  ready = true;
  loadedAt = now();
}

/**
 * Reemplaza UN namespace. La usa la ruta de admin después de escribir, para que
 * el proceso que guardó quede consistente al instante en el camino sync también.
 */
export function replaceSnapshotNamespace(namespace: string, rows: AppSettingRow[]): void {
  const bucket = new Map<string, AppSettingRow>();
  for (const row of rows) bucket.set(row.key, row);
  snapshot.set(namespace, bucket);
}

/** Sólo para tests. */
export function __resetSnapshot(): void {
  snapshot = new Map();
  ready = false;
  loadedAt = 0;
  refreshing = false;
  refresher = null;
}

/** Sólo para tests. */
export function __setSnapshotClock(clock: () => number): void {
  now = clock;
}
