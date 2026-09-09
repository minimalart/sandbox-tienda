import { Migration } from '@medusajs/framework/mikro-orm/migrations';
export class Migration20260907120000SpaceDesignerQuotes extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "space_quote" ("id" text not null, "configurator_id" text not null, "configurator_title" text not null, "sales_channel_id" text null, "customer_id" text null, "name" text not null, "email" text not null, "phone" text null, "message" text null, "template_id" text null, "template_name" text null, "snapshot" jsonb not null, "items" jsonb not null, "status" text not null default 'new' check ("status" in ('new', 'contacted', 'closed')), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "space_quote_pkey" primary key ("id"));`
    );
    for (const column of ['configurator_id', 'sales_channel_id', 'status', 'deleted_at'])
      this.addSql(
        `create index if not exists "IDX_space_quote_${column}" on "space_quote" ("${column}") where "deleted_at" is null;`
      );
  }
  override async down(): Promise<void> {
    this.addSql('drop table if exists "space_quote";');
  }
}
