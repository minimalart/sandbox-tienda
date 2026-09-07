import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `comment.site_id` — de qué tienda es cada comentario.
 *
 * Sin backfill: un producto puede estar en varias tiendas, así que no hay forma
 * confiable de asignar los comentarios viejos y adivinar sería inventar. Quedan en
 * `NULL` y se siguen moderando desde cualquier tienda — esconder reseñas de clientes
 * reales el día del deploy es peor que mostrarlas de más.
 */
export class Migration20260807190000Comments extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "comment" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_comment_site" ON "comment" ("site_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_comment_site";`);
    this.addSql(`ALTER TABLE IF EXISTS "comment" DROP COLUMN IF EXISTS "site_id";`);
  }
}
