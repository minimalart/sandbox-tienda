import { Migration } from '@medusajs/framework/mikro-orm/migrations';
export class Migration20260904153000SpaceDesigner extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "space_configurator" ("id" text not null, "slug" text not null, "title" text not null, "status" text not null default 'draft' check ("status" in ('draft', 'published')), "sales_channel_id" text null, "config" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "space_configurator_pkey" primary key ("id"));`
    );
    this.addSql(
      `create unique index if not exists "IDX_space_configurator_slug" on "space_configurator" ("slug") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_space_configurator_channel_status" on "space_configurator" ("sales_channel_id", "status") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_space_configurator_deleted_at" on "space_configurator" ("deleted_at") where "deleted_at" is null;`
    );
    this.addSql(
      `create table if not exists "space_design" ("id" text not null, "configurator_id" text not null, "customer_id" text not null, "sales_channel_id" text null, "name" text not null, "template_id" text null, "snapshot" jsonb not null, "configuration_snapshot" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "space_design_pkey" primary key ("id"));`
    );
    for (const column of ['customer_id', 'configurator_id', 'sales_channel_id', 'deleted_at'])
      this.addSql(
        `create index if not exists "IDX_space_design_${column}" on "space_design" ("${column}") where "deleted_at" is null;`
      );
  }
  override async down(): Promise<void> {
    this.addSql('drop table if exists "space_design";');
    this.addSql('drop table if exists "space_configurator";');
  }
}
