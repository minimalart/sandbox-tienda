"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260807190000Comments = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * `comment.site_id` — de qué tienda es cada comentario.
 *
 * Sin backfill: un producto puede estar en varias tiendas, así que no hay forma
 * confiable de asignar los comentarios viejos y adivinar sería inventar. Quedan en
 * `NULL` y se siguen moderando desde cualquier tienda — esconder reseñas de clientes
 * reales el día del deploy es peor que mostrarlas de más.
 */
class Migration20260807190000Comments extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE IF EXISTS "comment" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_comment_site" ON "comment" ("site_id");`);
    }
    async down() {
        this.addSql(`DROP INDEX IF EXISTS "IDX_comment_site";`);
        this.addSql(`ALTER TABLE IF EXISTS "comment" DROP COLUMN IF EXISTS "site_id";`);
    }
}
exports.Migration20260807190000Comments = Migration20260807190000Comments;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA4MDcxOTAwMDBDb21tZW50cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NvbW1lbnRzL21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA4MDcxOTAwMDBDb21tZW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7Ozs7R0FPRztBQUNILE1BQWEsK0JBQWdDLFNBQVEsc0JBQVM7SUFDbkQsS0FBSyxDQUFDLEVBQUU7UUFDZixJQUFJLENBQUMsTUFBTSxDQUFDLCtFQUErRSxDQUFDLENBQUM7UUFDN0YsSUFBSSxDQUFDLE1BQU0sQ0FBQyx5RUFBeUUsQ0FBQyxDQUFDO0lBQ3pGLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLDBDQUEwQyxDQUFDLENBQUM7UUFDeEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrRUFBa0UsQ0FBQyxDQUFDO0lBQ2xGLENBQUM7Q0FDRjtBQVZELDBFQVVDIn0=