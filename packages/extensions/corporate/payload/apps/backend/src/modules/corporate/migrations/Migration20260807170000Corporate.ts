import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `corporate.site_id` — las cuentas B2B dejan de ser de la instancia entera.
 *
 * Sólo la empresa lleva la columna. Miembros, reglas e invitaciones cuelgan de ella
 * por `corporate_id` y heredan la tienda de ahí.
 *
 * Sin backfill: las empresas existentes quedan en `NULL` = global. Esconder una
 * cuenta B2B viva el día del deploy le cortaría el acceso al comprador sin que nadie
 * lo haya decidido.
 */
export class Migration20260807170000Corporate extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "corporate" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_corporate_site" ON "corporate" ("site_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_corporate_site";`);
    this.addSql(`ALTER TABLE IF EXISTS "corporate" DROP COLUMN IF EXISTS "site_id";`);
  }
}
