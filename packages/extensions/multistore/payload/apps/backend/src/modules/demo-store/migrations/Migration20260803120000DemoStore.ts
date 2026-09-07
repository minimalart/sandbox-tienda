import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Adds the per-demo tinting toggle. When enabled, the storefront exposes the
 * color-first page ("Buscá tu color": pick a color, then see which bases achieve
 * it) and its nav link.
 *
 * It only gates the storefront surface: the tinting master data lives in the ERP
 * module and is shared by the whole instance, so /store/tinting/* still requires
 * the ERP `tinting.enabled` switch.
 *
 * Idempotent (ADD COLUMN IF NOT EXISTS) so it is safe on DBs where the column
 * already exists via ensure-tables.
 */
export class Migration20260803120000DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "tinting_enabled" boolean not null default false;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "demo_store" drop column if exists "tinting_enabled";`);
  }
}
