import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { LoaderOptions } from '@medusajs/framework/types';
import type { AppSettingRow } from '../resolve';
import { publishForeignSettingBridge } from '../plugin-bridge';
import { readEntriesFromBlob } from '../site-setting-store';
import { registerSnapshotRefresher, replaceSnapshot } from '../snapshot';

/**
 * Llena el snapshot sincrónico al arrancar, antes del primer request.
 *
 * Lee por `PG_CONNECTION` en crudo y NO resuelve ningún módulo. Eso no es
 * pereza: el contenedor que recibe un loader es HERMÉTICO — `load-internal.js`
 * lo crea sin padre y le re-exporta seis claves (`MANAGER`, `CONFIG_MODULE`,
 * `LOGGER`, `PG_CONNECTION`, `EVENT_BUS`, `CACHING`). `query` y los módulos
 * custom no están, y eso incluye al módulo de tiendas dueño de `site_setting`.
 * Es el mismo camino que ya usa `kapso-whatsapp/settings.ts` para el provider.
 *
 * SÓLO CARGA LAS FILAS GLOBALES (`site_id IS NULL`), y no es una optimización:
 * el snapshot es la vista de INSTANCIA y no puede ser otra cosa. Lo leen
 * constructores sin request, que no tienen tienda ni forma de tenerla. Cargar acá
 * los jsonb de todas las tiendas haría que la última en escribirse le ganara a
 * las demás en el camino sincrónico — un cross-tenant leak de proceso entero.
 * El cartel completo está en `resolve.ts:resolveSettingSync`.
 *
 * NUNCA bloquea el arranque. Si la tabla todavía no existe (primer deploy, antes
 * de migrar), si el proyecto no tiene el módulo de tiendas o si Postgres no
 * responde, se loguea y se sigue: el sistema queda leyendo `process.env`, que es
 * exactamente como funcionaba antes de esta migración.
 */
type Pg = { raw: (sql: string) => Promise<{ rows?: unknown[] }> };

/**
 * Una fila por namespace, con el jsonb entero. El desarmado por clave lo hace
 * `readEntriesFromBlob`, que es la MISMA función que usa el camino async: si
 * hubiera dos parsers del sobre, el sincrónico y el asíncrono podrían discrepar
 * sobre qué es un secreto.
 */
const SELECT_GLOBAL = `SELECT "namespace", "value"
     FROM "site_setting"
    WHERE "site_id" IS NULL AND "deleted_at" IS NULL`;

async function loadAll(pg: Pg): Promise<number> {
  const result = await pg.raw(SELECT_GLOBAL);
  const namespaces = (result.rows ?? []) as { namespace: string; value: unknown }[];

  const rows: (AppSettingRow & { namespace: string })[] = [];
  for (const row of namespaces) {
    for (const entry of readEntriesFromBlob(row.value).values()) {
      rows.push({ ...entry, namespace: row.namespace });
    }
  }
  replaceSnapshot(rows);
  return rows.length;
}

export default async function warmAppSettingsSnapshot({
  container,
  logger,
}: LoaderOptions): Promise<void> {
  // Antes de tocar Postgres, y a propósito: el puente es lo que le permite a un
  // PLUGIN leer un ajuste de la base en vez de sólo `process.env` (ver
  // `plugin-bridge.ts`). Publicarlo después del `resolve` lo dejaría sin publicar
  // justo cuando la base no responde — que es el momento en que más importa que
  // los plugins degraden al entorno por el camino previsto y no por ausencia de
  // puente. El lector consulta el snapshot en cada llamada, así que publicarlo
  // con el snapshot todavía vacío es correcto: devuelve el entorno hasta que se
  // llene, igual que cualquier lector sincrónico del host.
  publishForeignSettingBridge();

  let pg: Pg;
  try {
    pg = container.resolve<Pg>(ContainerRegistrationKeys.PG_CONNECTION);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger?.warn(`[app-settings] Sin conexión a Postgres en el loader (${message}).`);
    return;
  }

  // Deja registrada la recarga ANTES de intentar la primera lectura: si la tabla
  // todavía no existe (deploy nuevo, antes de migrar), el snapshot igual va a
  // poder recargarse solo cuando la migración termine, sin esperar un reinicio.
  registerSnapshotRefresher(async () => {
    await loadAll(pg);
  });

  try {
    const count = await loadAll(pg);
    logger?.info(`[app-settings] Snapshot cargado: ${count} ajuste(s) de instancia.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger?.warn(
      `[app-settings] No se pudo cargar el snapshot (${message}). ` +
        'La configuración se lee de las variables de entorno por ahora.',
    );
  }
}
