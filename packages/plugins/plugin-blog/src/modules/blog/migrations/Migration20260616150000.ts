import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260616150000 extends Migration {
  override async up(): Promise<void> {
    // blog_post
    this.addSql(
      `create table if not exists "blog_post" ("id" text not null, "title" text not null, "slug" text not null, "excerpt" text null, "cover_image" jsonb null, "content" jsonb null, "status" text not null default 'draft', "category_id" text null, "seo_title" text null, "seo_description" text null, "published_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "blog_post_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_blog_post_slug_unique" ON "blog_post" ("slug") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_blog_post_status" ON "blog_post" ("status") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_blog_post_category_id" ON "blog_post" ("category_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_blog_post_published_at" ON "blog_post" ("published_at") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_blog_post_status_slug" ON "blog_post" ("status", "slug") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_blog_post_deleted_at" ON "blog_post" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    // blog_category
    this.addSql(
      `create table if not exists "blog_category" ("id" text not null, "name" text not null, "slug" text not null, "description" text null, "image" jsonb null, "sort_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "blog_category_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_blog_category_slug_unique" ON "blog_category" ("slug") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_blog_category_sort_order" ON "blog_category" ("sort_order") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_blog_category_deleted_at" ON "blog_category" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    // blog_post_product
    this.addSql(
      `create table if not exists "blog_post_product" ("id" text not null, "blog_post_id" text not null, "product_id" text not null, "sort_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "blog_post_product_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_blog_post_product_post" ON "blog_post_product" ("blog_post_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_blog_post_product_unique" ON "blog_post_product" ("blog_post_id", "product_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_blog_post_product_deleted_at" ON "blog_post_product" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    // blog_settings (singleton)
    this.addSql(
      `create table if not exists "blog_settings" ("id" text not null, "section_name" text not null default 'Blog', "show_search" boolean not null default true, "show_categories" boolean not null default true, "posts_per_page" integer not null default 12, "default_seo_title" text null, "default_seo_description" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "blog_settings_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_blog_settings_deleted_at" ON "blog_settings" ("deleted_at") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "blog_post" cascade;`);
    this.addSql(`drop table if exists "blog_category" cascade;`);
    this.addSql(`drop table if exists "blog_post_product" cascade;`);
    this.addSql(`drop table if exists "blog_settings" cascade;`);
  }
}
