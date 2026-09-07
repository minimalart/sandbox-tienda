import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `contact_submission.site_id` — de qué tienda es cada mensaje.
 *
 * Nullable y sin backfill a propósito. Los mensajes anteriores a esta columna
 * no tienen forma confiable de asignarse a una tienda: el formulario no
 * guardaba el canal, y adivinar por fecha o por `source` sería inventar.
 * Quedan en `NULL`, y el descriptor los trata como visibles en todas hasta
 * que alguien decida qué hacer con ellos — esconder mensajes de clientes
 * reales el día del deploy es peor que mostrarlos de más.
 *
 * Nombre preservado del original (`Migration20260807140000Contact`) para que
 * MikroORM la skipee en tiendas que ya la corrieron con la extensión.
 */
export class Migration20260807140000Contact extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE IF EXISTS "contact_submission" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_contact_submission_site" ON "contact_submission" ("site_id");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_contact_submission_site";`);
    this.addSql(`ALTER TABLE IF EXISTS "contact_submission" DROP COLUMN IF EXISTS "site_id";`);
  }
}
