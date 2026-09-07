"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260807280000Catalogador = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * `cataloging_execution.site_id` — desde qué tienda se lanzó la corrida.
 *
 * Scopea el HISTORIAL, no el efecto: el producto que la corrida enriquece es compartido
 * por toda la instancia. Sirve para que el operador de una tienda vea sus corridas sin
 * el ruido de las demás.
 *
 * Sin backfill: las existentes quedan en `NULL` y se siguen viendo desde cualquier
 * tienda, porque esconder el historial de enriquecido dejaría sin explicación un
 * producto que cambió.
 */
class Migration20260807280000Catalogador extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE IF EXISTS "cataloging_execution" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cataloging_execution_site" ON "cataloging_execution" ("site_id") WHERE "deleted_at" IS NULL;`);
    }
    async down() {
        this.addSql(`DROP INDEX IF EXISTS "IDX_cataloging_execution_site";`);
        this.addSql(`ALTER TABLE IF EXISTS "cataloging_execution" DROP COLUMN IF EXISTS "site_id";`);
    }
}
exports.Migration20260807280000Catalogador = Migration20260807280000Catalogador;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA4MDcyODAwMDBDYXRhbG9nYWRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA4MDcyODAwMDBDYXRhbG9nYWRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7Ozs7Ozs7R0FVRztBQUNILE1BQWEsa0NBQW1DLFNBQVEsc0JBQVM7SUFDdEQsS0FBSyxDQUFDLEVBQUU7UUFDZixJQUFJLENBQUMsTUFBTSxDQUNULDRGQUE0RixDQUM3RixDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCw4SEFBOEgsQ0FDL0gsQ0FBQztJQUNKLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLHVEQUF1RCxDQUFDLENBQUM7UUFDckUsSUFBSSxDQUFDLE1BQU0sQ0FBQywrRUFBK0UsQ0FBQyxDQUFDO0lBQy9GLENBQUM7Q0FDRjtBQWRELGdGQWNDIn0=