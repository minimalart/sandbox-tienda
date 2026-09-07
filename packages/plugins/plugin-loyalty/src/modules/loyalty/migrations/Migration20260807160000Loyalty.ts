import { Migration } from '@medusajs/framework/mikro-orm/migrations';

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
export class Migration20260807160000Loyalty extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "loyalty_program" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_program_site" ON "loyalty_program" ("site_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_loyalty_program_site";`);
    this.addSql(`ALTER TABLE IF EXISTS "loyalty_program" DROP COLUMN IF EXISTS "site_id";`);
  }
}
