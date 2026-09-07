import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Prende `tinting_enabled` en la fila de la tienda PRINCIPAL.
 *
 * Backfill de una sola vez que acompaña al cableado del toggle en el storefront.
 * Hasta ahora `getTintingEnabled()` sólo consultaba la fila del sitio cuando había
 * un slug activo, así que en la principal el switch de /app/sites NO ESTABA
 * CABLEADO A NADA: la vidriera se mostraba con sólo el switch del ERP prendido, y
 * prender o apagar el toggle no producía ningún efecto observable.
 *
 * Ahora la fila manda en TODAS las tiendas, principal incluida. Sin este backfill,
 * cualquier instancia cuya fila principal quedó en el default `false` —que es la
 * mayoría, porque el toggle no servía para nada— perdería la página al deployar el
 * fix. Prenderlo no le da la vidriera a nadie que no la tuviera: el switch del ERP
 * sigue siendo la segunda llave y una tienda sin tintometría no muestra nada.
 *
 * Por eso tampoco pisa una decisión deliberada del operador: antes de este cambio,
 * apagar el toggle en la principal no significaba nada.
 *
 * Las bases que estrenan la columna en este mismo deploy ya vienen backfilleadas
 * desde `ensure-tables.ts`, que la crea dentro de un DO block con este mismo update.
 * Los dos caminos existen porque hay entornos donde el pipeline no corre
 * `medusa db:migrate` (ver el docblock de ensure-tables).
 */
export class Migration20260819120000DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `update "demo_store" set "tinting_enabled" = true where "is_main" and "deleted_at" is null;`
    );
  }

  /**
   * No hay `down`: el estado previo era `false` para unas filas y `true` para otras,
   * y no se guardó cuál era cuál. Apagarlas todas al rollbackear sería inventar una
   * decisión que nadie tomó — y encima le apagaría la página a quien sí la tenía.
   */
  override async down(): Promise<void> {}
}
