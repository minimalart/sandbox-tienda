"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260807170100DynamicGroups = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * `dynamic_group.site_id` — los grupos dinámicos pasan a ser por tienda.
 *
 * Los logs de membresía cuelgan del grupo y heredan la tienda por la FK. Sin
 * backfill: los grupos existentes quedan en `NULL` = global, así que una instalación
 * mono-tienda no cambia en nada.
 */
class Migration20260807170100DynamicGroups extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE IF EXISTS "dynamic_group" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dynamic_group_site" ON "dynamic_group" ("site_id");`);
    }
    async down() {
        this.addSql(`DROP INDEX IF EXISTS "IDX_dynamic_group_site";`);
        this.addSql(`ALTER TABLE IF EXISTS "dynamic_group" DROP COLUMN IF EXISTS "site_id";`);
    }
}
exports.Migration20260807170100DynamicGroups = Migration20260807170100DynamicGroups;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA4MDcxNzAxMDBEeW5hbWljR3JvdXBzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvZHluYW1pYy1ncm91cHMvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDgwNzE3MDEwMER5bmFtaWNHcm91cHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUVBQXFFO0FBRXJFOzs7Ozs7R0FNRztBQUNILE1BQWEsb0NBQXFDLFNBQVEsc0JBQVM7SUFDeEQsS0FBSyxDQUFDLEVBQUU7UUFDZixJQUFJLENBQUMsTUFBTSxDQUFDLHFGQUFxRixDQUFDLENBQUM7UUFDbkcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxxRkFBcUYsQ0FBQyxDQUFDO0lBQ3JHLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLGdEQUFnRCxDQUFDLENBQUM7UUFDOUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO0lBQ3hGLENBQUM7Q0FDRjtBQVZELG9GQVVDIn0=