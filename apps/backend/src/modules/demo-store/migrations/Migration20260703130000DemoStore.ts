import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Adds the per-demo `home_puck_data` JSON column: the Puck document
 * ({ content, root }) edited from the "Personalizar home" editor. When present,
 * the storefront renders the demo home from this ordered list of section blocks
 * instead of the hardcoded template layout. Idempotent so it is safe on DBs
 * where the column already exists via ensure-tables.
 */
export class Migration20260703130000DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "home_puck_data" jsonb null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "demo_store" drop column if exists "home_puck_data";`
    );
  }
}
