"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260807210000Ga4 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * `ga4_settings.site_id` — cada tienda puede medir en su propia propiedad de GA4.
 *
 * La fila existente queda en `NULL` y pasa a ser el GLOBAL: el fallback de toda tienda
 * que no configure la suya, y la que se sembró desde las env. Sin backfill.
 */
class Migration20260807210000Ga4 extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE IF EXISTS "ga4_settings" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_settings_site_unique"
         ON "ga4_settings" ("site_id") WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`);
    }
    async down() {
        this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_settings_site_unique";`);
        this.addSql(`ALTER TABLE IF EXISTS "ga4_settings" DROP COLUMN IF EXISTS "site_id";`);
    }
}
exports.Migration20260807210000Ga4 = Migration20260807210000Ga4;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA4MDcyMTAwMDBHYTQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9nYTQvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDgwNzIxMDAwMEdhNC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7O0dBS0c7QUFDSCxNQUFhLDBCQUEyQixTQUFRLHNCQUFTO0lBQzlDLEtBQUssQ0FBQyxFQUFFO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxvRkFBb0YsQ0FBQyxDQUFDO1FBQ2xHLElBQUksQ0FBQyxNQUFNLENBQ1Q7NkZBQ3VGLENBQ3hGLENBQUM7SUFDSixDQUFDO0lBRVEsS0FBSyxDQUFDLElBQUk7UUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxzREFBc0QsQ0FBQyxDQUFDO1FBQ3BFLElBQUksQ0FBQyxNQUFNLENBQUMsdUVBQXVFLENBQUMsQ0FBQztJQUN2RixDQUFDO0NBQ0Y7QUFiRCxnRUFhQyJ9