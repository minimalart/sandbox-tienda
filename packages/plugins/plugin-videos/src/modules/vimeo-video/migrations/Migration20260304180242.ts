import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260304180242 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_video_link" drop constraint if exists "product_video_link_product_id_vimeo_video_id_unique";`
    );
    this.addSql(
      `alter table if exists "vimeo_video" drop constraint if exists "vimeo_video_vimeo_id_unique";`
    );
    this.addSql(
      `create table if not exists "vimeo_token" ("id" text not null, "access_token" text not null, "refresh_token" text null, "token_type" text not null, "scope" text null, "expires_at" timestamptz not null, "user_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vimeo_token_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vimeo_token_deleted_at" ON "vimeo_token" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `create table if not exists "vimeo_video" ("id" text not null, "vimeo_id" text not null, "vimeo_uri" text not null, "title" text not null, "description" text null, "thumbnail_url" text null, "vimeo_url" text null, "duration" integer null, "status" text check ("status" in ('uploading', 'processing', 'available', 'error')) not null default 'uploading', "is_active" boolean not null default true, "sort_order" integer not null default 0, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vimeo_video_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vimeo_video_vimeo_id_unique" ON "vimeo_video" ("vimeo_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vimeo_video_deleted_at" ON "vimeo_video" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `create table if not exists "product_video_link" ("id" text not null, "product_id" text not null, "vimeo_video_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_video_link_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_video_link_vimeo_video_id" ON "product_video_link" ("vimeo_video_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_video_link_deleted_at" ON "product_video_link" ("deleted_at") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_video_link_product_id_vimeo_video_id_unique" ON "product_video_link" ("product_id", "vimeo_video_id") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `alter table if exists "product_video_link" add constraint "product_video_link_vimeo_video_id_foreign" foreign key ("vimeo_video_id") references "vimeo_video" ("id") on update cascade;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "product_video_link" drop constraint if exists "product_video_link_vimeo_video_id_foreign";`
    );

    this.addSql(`drop table if exists "vimeo_token" cascade;`);
    this.addSql(`drop table if exists "vimeo_video" cascade;`);
    this.addSql(`drop table if exists "product_video_link" cascade;`);
  }
}
