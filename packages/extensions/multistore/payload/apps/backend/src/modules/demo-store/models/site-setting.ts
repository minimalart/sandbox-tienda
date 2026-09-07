import { model } from '@medusajs/framework/utils';

/**
 * Configuración por tienda, con namespaces y versionado.
 *
 * Reemplaza a `site_manager_setting`, que se va con la extensión "Sitio". Nace acá
 * —dentro del módulo de tiendas, que va a ser `required` en el catálogo— y no como
 * una migración de la tabla vieja, y eso compra tres cosas:
 *
 *  1. `site_id` existe desde la primera fila: no hay que migrar datos vivos ni
 *     decidir qué significa el `NULL` de las filas que ya estaban.
 *  2. El locking se puede hacer bien. El de `site_manager_setting` compara
 *     `expectedRevision` y después escribe, sin transacción ni `WHERE revision = ?`:
 *     dos writers con el mismo `expectedRevision` pasan LOS DOS el check, y el que
 *     pierde choca contra el índice único **después de haber pisado el valor**.
 *  3. La tabla puede tener los índices que hacen falta desde el principio.
 *
 * `site_id NULL` = valor GLOBAL de la instancia, que es el fallback cuando una tienda
 * no definió el suyo. Ver `pickBySitePrecedence` en `lib/multistore/scope.ts`: al
 * LISTAR, la global se incluye; al RESOLVER el valor efectivo, la de la tienda gana.
 */
export const SiteSetting = model
  .define('site_setting', {
    id: model.id({ prefix: 'sset' }).primaryKey(),
    /** `NULL` = global de la instancia. */
    site_id: model.text().nullable(),
    namespace: model.text(),
    value: model.json(),
  })
  .indexes([
    /**
     * DOS índices parciales y no uno solo sobre `(site_id, namespace)`.
     *
     * En Postgres `NULL != NULL` dentro de un índice único, así que un
     * `UNIQUE (site_id, namespace)` NO impide dos filas globales con el mismo
     * namespace — y ahí `pickBySitePrecedence` elegiría una de las dos al azar.
     */
    {
      on: ['namespace'],
      unique: true,
      where: 'site_id IS NULL AND deleted_at IS NULL',
    },
    {
      on: ['site_id', 'namespace'],
      unique: true,
      where: 'site_id IS NOT NULL AND deleted_at IS NULL',
    },
  ]);

/**
 * Historial de cambios. Append-only: un rollback no borra, crea una revisión nueva
 * con el valor viejo.
 *
 * El índice único sobre la revisión no es decorativo: es el árbitro de las carreras.
 * `upsertSiteSetting` crea la revisión ANTES de tocar el valor, así que dos writers
 * simultáneos compiten por el mismo número y la DB decide — el perdedor falla sin
 * haber escrito nada.
 */
export const SiteSettingRevision = model
  .define('site_setting_revision', {
    id: model.id({ prefix: 'srev' }).primaryKey(),
    site_id: model.text().nullable(),
    namespace: model.text(),
    revision: model.number(),
    value: model.json(),
    actor_id: model.text().nullable(),
    note: model.text().nullable(),
  })
  .indexes([
    {
      on: ['namespace', 'revision'],
      unique: true,
      where: 'site_id IS NULL AND deleted_at IS NULL',
    },
    {
      on: ['site_id', 'namespace', 'revision'],
      unique: true,
      where: 'site_id IS NOT NULL AND deleted_at IS NULL',
    },
    { on: ['namespace', 'created_at'] },
  ]);
