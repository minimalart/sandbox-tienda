"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260807180000GiftCardExperience = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * `gift_card_settings.site_id` — la configuración de gift cards deja de ser singleton.
 *
 * La fila `NULL` sigue siendo la de siempre y pasa a ser el GLOBAL: el fallback de
 * toda tienda que no defina la suya. Sin backfill, sin cambio de comportamiento.
 *
 * El índice único viejo era sobre `singleton_key` a secas. Se reemplaza por DOS
 * parciales: en Postgres `NULL != NULL`, así que un único `UNIQUE (site_id,
 * singleton_key)` dejaría pasar dos filas globales y `getSettings` devolvería
 * cualquiera de las dos según el plan de ejecución.
 */
class Migration20260807180000GiftCardExperience extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE IF EXISTS "gift_card_settings" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_settings_singleton_key_unique";`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_settings_global_unique"
         ON "gift_card_settings" ("singleton_key") WHERE "site_id" IS NULL AND "deleted_at" IS NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_settings_site_unique"
         ON "gift_card_settings" ("site_id", "singleton_key") WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_settings_site" ON "gift_card_settings" ("site_id");`);
    }
    async down() {
        this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_settings_site";`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_settings_site_unique";`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_settings_global_unique";`);
        this.addSql(`ALTER TABLE IF EXISTS "gift_card_settings" DROP COLUMN IF EXISTS "site_id";`);
    }
}
exports.Migration20260807180000GiftCardExperience = Migration20260807180000GiftCardExperience;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA4MDcxODAwMDBHaWZ0Q2FyZEV4cGVyaWVuY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9naWZ0LWNhcmQtZXhwZXJpZW5jZS9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwODA3MTgwMDAwR2lmdENhcmRFeHBlcmllbmNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlFQUFxRTtBQUVyRTs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBYSx5Q0FBMEMsU0FBUSxzQkFBUztJQUM3RCxLQUFLLENBQUMsRUFBRTtRQUNmLElBQUksQ0FBQyxNQUFNLENBQUMsMEZBQTBGLENBQUMsQ0FBQztRQUN4RyxJQUFJLENBQUMsTUFBTSxDQUFDLHFFQUFxRSxDQUFDLENBQUM7UUFDbkYsSUFBSSxDQUFDLE1BQU0sQ0FDVDtxR0FDK0YsQ0FDaEcsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1Q7b0hBQzhHLENBQy9HLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUFDLCtGQUErRixDQUFDLENBQUM7SUFDL0csQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMscURBQXFELENBQUMsQ0FBQztRQUNuRSxJQUFJLENBQUMsTUFBTSxDQUFDLDREQUE0RCxDQUFDLENBQUM7UUFDMUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyw4REFBOEQsQ0FBQyxDQUFDO1FBQzVFLElBQUksQ0FBQyxNQUFNLENBQUMsNkVBQTZFLENBQUMsQ0FBQztJQUM3RixDQUFDO0NBQ0Y7QUFyQkQsOEZBcUJDIn0=