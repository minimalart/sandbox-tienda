"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260702130000Ga4 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * Agrega `hidden` a ga4_builtin_setting: permite "borrar" (ocultar) un evento
 * ecommerce built-in. Oculto = sale de la lista y nunca dispara; es reversible
 * (restaurar) porque el catálogo vive en código y no se puede recrear de cero.
 *
 * Renombrada de `Migration20260702130000` para cumplir la convención de sufijo de
 * módulo que exige `migration-names.test.ts`. El `up()` es idempotente
 * (`add column if not exists`), así que re-correr bajo el nombre nuevo en una DB
 * donde ya se aplicó el nombre viejo es un no-op.
 */
class Migration20260702130000Ga4 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "ga4_builtin_setting" add column if not exists "hidden" boolean not null default false;`);
    }
    async down() {
        this.addSql(`alter table if exists "ga4_builtin_setting" drop column if exists "hidden";`);
    }
}
exports.Migration20260702130000Ga4 = Migration20260702130000Ga4;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MDIxMzAwMDBHYTQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9nYTQvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDcwMjEzMDAwMEdhNC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBYSwwQkFBMkIsU0FBUSxzQkFBUztJQUM5QyxLQUFLLENBQUMsRUFBRTtRQUNmLElBQUksQ0FBQyxNQUFNLENBQ1QsK0dBQStHLENBQ2hILENBQUM7SUFDSixDQUFDO0lBRVEsS0FBSyxDQUFDLElBQUk7UUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQyw2RUFBNkUsQ0FBQyxDQUFDO0lBQzdGLENBQUM7Q0FDRjtBQVZELGdFQVVDIn0=