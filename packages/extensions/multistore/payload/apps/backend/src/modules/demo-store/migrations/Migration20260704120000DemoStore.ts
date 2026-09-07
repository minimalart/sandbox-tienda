import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Adds the per-demo B2B / Mayorista columns. When `b2b_enabled`, provisioning
 * creates a dedicated wholesale sales channel + customer group + demo company +
 * test buyer, and the import runner builds a tiered wholesale price list. The
 * *_id columns are filled by provisioning; the test credentials are surfaced in
 * the admin so the demo B2B portal is usable right away.
 *
 * Idempotent (ADD COLUMN IF NOT EXISTS) so it is safe on DBs where the columns
 * already exist via ensure-tables.
 */
export class Migration20260704120000DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "b2b_enabled" boolean not null default false;`
    );
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "b2b_sales_channel_id" text null;`
    );
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "b2b_customer_group_id" text null;`
    );
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "b2b_price_list_id" text null;`
    );
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "b2b_company_id" text null;`
    );
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "b2b_test_email" text null;`
    );
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "b2b_test_password" text null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "demo_store" drop column if exists "b2b_enabled";`);
    this.addSql(`alter table if exists "demo_store" drop column if exists "b2b_sales_channel_id";`);
    this.addSql(`alter table if exists "demo_store" drop column if exists "b2b_customer_group_id";`);
    this.addSql(`alter table if exists "demo_store" drop column if exists "b2b_price_list_id";`);
    this.addSql(`alter table if exists "demo_store" drop column if exists "b2b_company_id";`);
    this.addSql(`alter table if exists "demo_store" drop column if exists "b2b_test_email";`);
    this.addSql(`alter table if exists "demo_store" drop column if exists "b2b_test_password";`);
  }
}
