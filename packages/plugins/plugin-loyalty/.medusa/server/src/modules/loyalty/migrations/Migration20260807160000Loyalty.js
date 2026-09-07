"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260807160000Loyalty = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * `loyalty_program.site_id` — el programa de fidelidad deja de ser uno por instancia.
 *
 * Sólo el programa lleva la columna. Sus tiers, rewards, campaigns y earn-rules ya
 * apuntan al programa por FK y heredan la tienda de ahí; los grants llegan por
 * `reward`. Denormalizar `site_id` en las cinco tablas habría dejado cinco lugares
 * donde una escritura puede olvidarse de setearlo.
 *
 * Sin backfill: los programas existentes quedan en `NULL` = global, así que una
 * instalación mono-tienda no cambia en nada.
 */
class Migration20260807160000Loyalty extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE IF EXISTS "loyalty_program" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_program_site" ON "loyalty_program" ("site_id");`);
    }
    async down() {
        this.addSql(`DROP INDEX IF EXISTS "IDX_loyalty_program_site";`);
        this.addSql(`ALTER TABLE IF EXISTS "loyalty_program" DROP COLUMN IF EXISTS "site_id";`);
    }
}
exports.Migration20260807160000Loyalty = Migration20260807160000Loyalty;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA4MDcxNjAwMDBMb3lhbHR5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvbG95YWx0eS9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwODA3MTYwMDAwTG95YWx0eS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7Ozs7Ozs7R0FVRztBQUNILE1BQWEsOEJBQStCLFNBQVEsc0JBQVM7SUFDbEQsS0FBSyxDQUFDLEVBQUU7UUFDZixJQUFJLENBQUMsTUFBTSxDQUFDLHVGQUF1RixDQUFDLENBQUM7UUFDckcsSUFBSSxDQUFDLE1BQU0sQ0FBQyx5RkFBeUYsQ0FBQyxDQUFDO0lBQ3pHLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLGtEQUFrRCxDQUFDLENBQUM7UUFDaEUsSUFBSSxDQUFDLE1BQU0sQ0FBQywwRUFBMEUsQ0FBQyxDQUFDO0lBQzFGLENBQUM7Q0FDRjtBQVZELHdFQVVDIn0=