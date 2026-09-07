import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260624190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "demo_import_job" add column if not exists "linked_products" integer not null default 0;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "demo_import_job" drop column if exists "linked_products";`);
  }
}
