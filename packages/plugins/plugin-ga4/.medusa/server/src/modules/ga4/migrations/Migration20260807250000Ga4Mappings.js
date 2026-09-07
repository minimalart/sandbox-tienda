"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260807250000Ga4Mappings = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * `site_id` en el mapeo de eventos y en los builtins de GA4.
 *
 * Las filas existentes quedan en `NULL` = GLOBAL: el mapeo por defecto que comparten
 * todas las tiendas. Una marca puede definir el suyo para una clave sin tocárselo a las
 * demás.
 *
 * Los únicos viejos no contemplaban la columna. Se parten en DOS parciales cada uno:
 * en Postgres `NULL != NULL`, así que un único índice sobre `(site_id, …)` dejaría
 * pasar dos globales idénticos y cuál gana dependería del plan de ejecución.
 */
class Migration20260807250000Ga4Mappings extends migrations_1.Migration {
    async up() {
        for (const table of ['ga4_event_mapping', 'ga4_builtin_setting']) {
            this.addSql(`ALTER TABLE IF EXISTS "${table}" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
            this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_${table}_site" ON "${table}" ("site_id");`);
        }
        this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_event_mapping_event_unique";`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_event_mapping_global_unique"
         ON "ga4_event_mapping" ("medusa_event", "ga4_event_name")
         WHERE "site_id" IS NULL AND "deleted_at" IS NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_event_mapping_site_unique"
         ON "ga4_event_mapping" ("site_id", "medusa_event", "ga4_event_name")
         WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_builtin_setting_key_unique";`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_builtin_setting_global_unique"
         ON "ga4_builtin_setting" ("builtin_key")
         WHERE "site_id" IS NULL AND "deleted_at" IS NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_builtin_setting_site_unique"
         ON "ga4_builtin_setting" ("site_id", "builtin_key")
         WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`);
    }
    async down() {
        this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_builtin_setting_site_unique";`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_builtin_setting_global_unique";`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_event_mapping_site_unique";`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_event_mapping_global_unique";`);
        for (const table of ['ga4_event_mapping', 'ga4_builtin_setting']) {
            this.addSql(`DROP INDEX IF EXISTS "IDX_${table}_site";`);
            this.addSql(`ALTER TABLE IF EXISTS "${table}" DROP COLUMN IF EXISTS "site_id";`);
        }
    }
}
exports.Migration20260807250000Ga4Mappings = Migration20260807250000Ga4Mappings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA4MDcyNTAwMDBHYTRNYXBwaW5ncy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2dhNC9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwODA3MjUwMDAwR2E0TWFwcGluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUVBQXFFO0FBRXJFOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFhLGtDQUFtQyxTQUFRLHNCQUFTO0lBQ3RELEtBQUssQ0FBQyxFQUFFO1FBQ2YsS0FBSyxNQUFNLEtBQUssSUFBSSxDQUFDLG1CQUFtQixFQUFFLHFCQUFxQixDQUFDLEVBQUUsQ0FBQztZQUNqRSxJQUFJLENBQUMsTUFBTSxDQUFDLDBCQUEwQixLQUFLLGlEQUFpRCxDQUFDLENBQUM7WUFDOUYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtQ0FBbUMsS0FBSyxjQUFjLEtBQUssZ0JBQWdCLENBQUMsQ0FBQztRQUMzRixDQUFDO1FBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyw0REFBNEQsQ0FBQyxDQUFDO1FBQzFFLElBQUksQ0FBQyxNQUFNLENBQ1Q7OzJEQUVxRCxDQUN0RCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVDs7K0RBRXlELENBQzFELENBQUM7UUFFRixJQUFJLENBQUMsTUFBTSxDQUFDLDREQUE0RCxDQUFDLENBQUM7UUFDMUUsSUFBSSxDQUFDLE1BQU0sQ0FDVDs7MkRBRXFELENBQ3RELENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNUOzsrREFFeUQsQ0FDMUQsQ0FBQztJQUNKLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLDZEQUE2RCxDQUFDLENBQUM7UUFDM0UsSUFBSSxDQUFDLE1BQU0sQ0FBQywrREFBK0QsQ0FBQyxDQUFDO1FBQzdFLElBQUksQ0FBQyxNQUFNLENBQUMsMkRBQTJELENBQUMsQ0FBQztRQUN6RSxJQUFJLENBQUMsTUFBTSxDQUFDLDZEQUE2RCxDQUFDLENBQUM7UUFDM0UsS0FBSyxNQUFNLEtBQUssSUFBSSxDQUFDLG1CQUFtQixFQUFFLHFCQUFxQixDQUFDLEVBQUUsQ0FBQztZQUNqRSxJQUFJLENBQUMsTUFBTSxDQUFDLDZCQUE2QixLQUFLLFNBQVMsQ0FBQyxDQUFDO1lBQ3pELElBQUksQ0FBQyxNQUFNLENBQUMsMEJBQTBCLEtBQUssb0NBQW9DLENBQUMsQ0FBQztRQUNuRixDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBMUNELGdGQTBDQyJ9