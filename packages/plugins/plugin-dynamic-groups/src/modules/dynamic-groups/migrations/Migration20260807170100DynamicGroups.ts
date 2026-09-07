import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `dynamic_group.site_id` — los grupos dinámicos pasan a ser por tienda.
 *
 * Los logs de membresía cuelgan del grupo y heredan la tienda por la FK. Sin
 * backfill: los grupos existentes quedan en `NULL` = global, así que una instalación
 * mono-tienda no cambia en nada.
 */
export class Migration20260807170100DynamicGroups extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "dynamic_group" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dynamic_group_site" ON "dynamic_group" ("site_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_dynamic_group_site";`);
    this.addSql(`ALTER TABLE IF EXISTS "dynamic_group" DROP COLUMN IF EXISTS "site_id";`);
  }
}
