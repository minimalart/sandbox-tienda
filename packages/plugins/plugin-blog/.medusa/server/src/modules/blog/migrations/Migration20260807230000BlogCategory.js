"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260807230000BlogCategory = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * `blog_category.site_id` — las categorías del blog pueden ser por tienda.
 *
 * Sin backfill: las existentes quedan en `NULL` = taxonomía compartida. Esconderlas
 * dejaría posts publicados apuntando a una categoría que el operador no ve en su
 * listado, y el post se rompería sin que nada avise.
 */
class Migration20260807230000BlogCategory extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE IF EXISTS "blog_category" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_category_site" ON "blog_category" ("site_id");`);
    }
    async down() {
        this.addSql(`DROP INDEX IF EXISTS "IDX_blog_category_site";`);
        this.addSql(`ALTER TABLE IF EXISTS "blog_category" DROP COLUMN IF EXISTS "site_id";`);
    }
}
exports.Migration20260807230000BlogCategory = Migration20260807230000BlogCategory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA4MDcyMzAwMDBCbG9nQ2F0ZWdvcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9ibG9nL21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA4MDcyMzAwMDBCbG9nQ2F0ZWdvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUVBQXFFO0FBRXJFOzs7Ozs7R0FNRztBQUNILE1BQWEsbUNBQW9DLFNBQVEsc0JBQVM7SUFDdkQsS0FBSyxDQUFDLEVBQUU7UUFDZixJQUFJLENBQUMsTUFBTSxDQUFDLHFGQUFxRixDQUFDLENBQUM7UUFDbkcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxxRkFBcUYsQ0FBQyxDQUFDO0lBQ3JHLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLGdEQUFnRCxDQUFDLENBQUM7UUFDOUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO0lBQ3hGLENBQUM7Q0FDRjtBQVZELGtGQVVDIn0=