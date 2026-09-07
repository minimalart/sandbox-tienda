import { Migration } from '@medusajs/framework/mikro-orm/migrations';

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
export class Migration20260807280000Catalogador extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE IF EXISTS "cataloging_execution" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cataloging_execution_site" ON "cataloging_execution" ("site_id") WHERE "deleted_at" IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_cataloging_execution_site";`);
    this.addSql(`ALTER TABLE IF EXISTS "cataloging_execution" DROP COLUMN IF EXISTS "site_id";`);
  }
}
