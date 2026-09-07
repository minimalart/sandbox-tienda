"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260807200100Blog = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * `blog_settings.site_id` — la config del blog deja de ser singleton.
 *
 * La fila existente queda en `NULL` = GLOBAL, el fallback de toda tienda sin config
 * propia. Sin backfill.
 */
class Migration20260807200100Blog extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE IF EXISTS "blog_settings" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_blog_settings_site_unique"
         ON "blog_settings" ("site_id") WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`);
    }
    async down() {
        this.addSql(`DROP INDEX IF EXISTS "IDX_blog_settings_site_unique";`);
        this.addSql(`ALTER TABLE IF EXISTS "blog_settings" DROP COLUMN IF EXISTS "site_id";`);
    }
}
exports.Migration20260807200100Blog = Migration20260807200100Blog;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA4MDcyMDAxMDBCbG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvYmxvZy9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwODA3MjAwMTAwQmxvZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7O0dBS0c7QUFDSCxNQUFhLDJCQUE0QixTQUFRLHNCQUFTO0lBQy9DLEtBQUssQ0FBQyxFQUFFO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxxRkFBcUYsQ0FBQyxDQUFDO1FBQ25HLElBQUksQ0FBQyxNQUFNLENBQ1Q7OEZBQ3dGLENBQ3pGLENBQUM7SUFDSixDQUFDO0lBRVEsS0FBSyxDQUFDLElBQUk7UUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO1FBQ3JFLElBQUksQ0FBQyxNQUFNLENBQUMsd0VBQXdFLENBQUMsQ0FBQztJQUN4RixDQUFDO0NBQ0Y7QUFiRCxrRUFhQyJ9