import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Adds the per-demo `content_config` JSON column: section visibility toggles
 * (blog/contact/shopping-list) + editable texts (blog section name, shopping
 * list copy, "Explorar" quick suggestions). Idempotent so it is safe on DBs
 * where the column already exists via ensure-tables.
 */
export class Migration20260703120000DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "content_config" jsonb null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "demo_store" drop column if exists "content_config";`
    );
  }
}
