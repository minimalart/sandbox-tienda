import { Migration } from '@mikro-orm/migrations';
export class Migration20260907180000DemoStore extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'alter table if exists "demo_store" add column if not exists "b2b_sales_channel_owned" boolean not null default true;'
    );
    this.addSql(
      'alter table if exists "demo_store" add column if not exists "b2b_price_list_owned" boolean not null default true;'
    );
    this.addSql(
      'alter table if exists "demo_store" add column if not exists "b2b_pricing_tiers" jsonb null;'
    );
  }
  async down(): Promise<void> {
    this.addSql(
      'alter table if exists "demo_store" drop column if exists "b2b_sales_channel_owned";'
    );
    this.addSql('alter table if exists "demo_store" drop column if exists "b2b_price_list_owned";');
    this.addSql('alter table if exists "demo_store" drop column if exists "b2b_pricing_tiers";');
  }
}
