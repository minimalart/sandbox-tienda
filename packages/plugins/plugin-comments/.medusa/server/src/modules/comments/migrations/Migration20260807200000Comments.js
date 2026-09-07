"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260807200000Comments = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * `comment_settings.site_id` — la config de moderación deja de ser singleton.
 *
 * La fila existente queda en `NULL` y pasa a ser el GLOBAL: el fallback de toda tienda
 * que no defina la suya. Sin backfill, sin cambio de comportamiento.
 */
class Migration20260807200000Comments extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE IF EXISTS "comment_settings" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_comment_settings_site_unique"
         ON "comment_settings" ("site_id") WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`);
    }
    async down() {
        this.addSql(`DROP INDEX IF EXISTS "IDX_comment_settings_site_unique";`);
        this.addSql(`ALTER TABLE IF EXISTS "comment_settings" DROP COLUMN IF EXISTS "site_id";`);
    }
}
exports.Migration20260807200000Comments = Migration20260807200000Comments;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA4MDcyMDAwMDBDb21tZW50cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NvbW1lbnRzL21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA4MDcyMDAwMDBDb21tZW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7O0dBS0c7QUFDSCxNQUFhLCtCQUFnQyxTQUFRLHNCQUFTO0lBQ25ELEtBQUssQ0FBQyxFQUFFO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQyx3RkFBd0YsQ0FBQyxDQUFDO1FBQ3RHLElBQUksQ0FBQyxNQUFNLENBQ1Q7aUdBQzJGLENBQzVGLENBQUM7SUFDSixDQUFDO0lBRVEsS0FBSyxDQUFDLElBQUk7UUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQywwREFBMEQsQ0FBQyxDQUFDO1FBQ3hFLElBQUksQ0FBQyxNQUFNLENBQUMsMkVBQTJFLENBQUMsQ0FBQztJQUMzRixDQUFDO0NBQ0Y7QUFiRCwwRUFhQyJ9