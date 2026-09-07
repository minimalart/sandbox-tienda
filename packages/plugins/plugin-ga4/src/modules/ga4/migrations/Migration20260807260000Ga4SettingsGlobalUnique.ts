import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Cierra el fail-open de `ga4_settings`: NO había único para la fila GLOBAL.
 *
 * `Migration20260807210000Ga4` creó un único parcial sobre `site_id` con
 * `WHERE site_id IS NOT NULL`, así que la unicidad quedó garantizada sólo para las
 * filas de tienda. La global (`site_id IS NULL`) quedó sin ninguna: en Postgres
 * `NULL != NULL`, de modo que ni siquiera un `UNIQUE (site_id)` a secas la hubiera
 * cubierto. Bajo carrera entran dos globales y `getSettings()` —que hace
 * `listGa4Settings({ site_id: null }, { take: 1 })`, sin ORDER BY— devuelve
 * cualquiera de las dos según el plan de ejecución. Se manifiesta meses después
 * como "la configuración de GA4 se revierte sola".
 *
 * Para poder indexar la fila global hace falta una columna discriminante: un
 * `UNIQUE (site_id) WHERE site_id IS NULL` no restringe nada, porque todos los
 * valores indexados son NULL y en un único los NULL no colisionan entre sí. Se
 * agrega `singleton_key` con default `'default'`, igual que `gift_card_settings`
 * (`Migration20260807180000GiftCardExperience`), y el único global va sobre ella.
 * El único por tienda queda como está: `UNIQUE (site_id) WHERE site_id IS NOT NULL`
 * ya es más estricto (una sola fila por tienda) y no hace falta tocarlo.
 *
 * ESTADO SUCIO: una base que ya tenga dos globales haría fallar el
 * `CREATE UNIQUE INDEX` y dejaría el deploy trabado en un error que no se arregla
 * reintentando. Por eso el dedupe va ANTES, en la misma transacción: se conserva la
 * global más reciente (`updated_at`, y como desempate `created_at` e `id`) y las
 * demás se marcan `deleted_at = NOW()`. Es un SOFT delete a propósito: la tabla
 * guarda `api_secret` y un DELETE tiraría un secreto que no se puede recuperar; el
 * índice es parcial sobre `deleted_at IS NULL`, así que soft-borrar alcanza para
 * liberar el conflicto y la fila queda auditable. No se usa
 * `CREATE INDEX CONCURRENTLY` porque no corre dentro de la transacción en la que
 * MikroORM envuelve cada migración, y dejaría el índice `INVALID` ante una falla.
 */
export class Migration20260807260000Ga4SettingsGlobalUnique extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE IF EXISTS "ga4_settings"
         ADD COLUMN IF NOT EXISTS "singleton_key" TEXT NOT NULL DEFAULT 'default';`,
    );

    // Dedupe previo: sin esto el CREATE UNIQUE INDEX de abajo puede reventar el deploy.
    this.addSql(
      `UPDATE "ga4_settings" AS s
          SET "deleted_at" = NOW(), "updated_at" = NOW()
        WHERE s."site_id" IS NULL
          AND s."deleted_at" IS NULL
          AND s."id" <> (
            SELECT w."id"
              FROM "ga4_settings" w
             WHERE w."site_id" IS NULL
               AND w."deleted_at" IS NULL
               AND w."singleton_key" = s."singleton_key"
             ORDER BY w."updated_at" DESC NULLS LAST,
                      w."created_at" DESC NULLS LAST,
                      w."id" DESC
             LIMIT 1
          );`,
    );

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_settings_global_unique"
         ON "ga4_settings" ("singleton_key") WHERE "site_id" IS NULL AND "deleted_at" IS NULL;`,
    );

    // El modelo declara el índice de lectura por tienda desde que existe `site_id`,
    // pero ninguna migración lo creó: `db:generate` lo iba a proponer suelto.
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ga4_settings_site"
         ON "ga4_settings" ("site_id") WHERE "deleted_at" IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    // Las filas soft-borradas por el dedupe NO se revierten: no hay forma de
    // distinguirlas de un borrado legítimo, y revivirlas recrearía el duplicado.
    this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_settings_site";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_settings_global_unique";`);
    this.addSql(`ALTER TABLE IF EXISTS "ga4_settings" DROP COLUMN IF EXISTS "singleton_key";`);
  }
}
