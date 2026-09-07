import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Adds the per-demo "Compras recurrentes" toggle. When enabled, the storefront
 * shows the subscribe UI and the backend accepts recurring-order creation for
 * the demo's sales channel (see modules/recurring-order).
 *
 * Idempotent (ADD COLUMN IF NOT EXISTS) so it is safe on DBs where the column
 * already exists via ensure-tables.
 */
export class Migration20260706150001DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "recurring_enabled" boolean not null default false;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "demo_store" drop column if exists "recurring_enabled";`);
  }
}
