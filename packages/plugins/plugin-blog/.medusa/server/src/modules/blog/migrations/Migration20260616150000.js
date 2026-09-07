"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260616150000 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260616150000 extends migrations_1.Migration {
    async up() {
        // blog_post
        this.addSql(`create table if not exists "blog_post" ("id" text not null, "title" text not null, "slug" text not null, "excerpt" text null, "cover_image" jsonb null, "content" jsonb null, "status" text not null default 'draft', "category_id" text null, "seo_title" text null, "seo_description" text null, "published_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "blog_post_pkey" primary key ("id"));`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_blog_post_slug_unique" ON "blog_post" ("slug") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_post_status" ON "blog_post" ("status") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_post_category_id" ON "blog_post" ("category_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_post_published_at" ON "blog_post" ("published_at") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_post_status_slug" ON "blog_post" ("status", "slug") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_post_deleted_at" ON "blog_post" ("deleted_at") WHERE deleted_at IS NULL;`);
        // blog_category
        this.addSql(`create table if not exists "blog_category" ("id" text not null, "name" text not null, "slug" text not null, "description" text null, "image" jsonb null, "sort_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "blog_category_pkey" primary key ("id"));`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_blog_category_slug_unique" ON "blog_category" ("slug") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_category_sort_order" ON "blog_category" ("sort_order") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_category_deleted_at" ON "blog_category" ("deleted_at") WHERE deleted_at IS NULL;`);
        // blog_post_product
        this.addSql(`create table if not exists "blog_post_product" ("id" text not null, "blog_post_id" text not null, "product_id" text not null, "sort_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "blog_post_product_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_post_product_post" ON "blog_post_product" ("blog_post_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_blog_post_product_unique" ON "blog_post_product" ("blog_post_id", "product_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_post_product_deleted_at" ON "blog_post_product" ("deleted_at") WHERE deleted_at IS NULL;`);
        // blog_settings (singleton)
        this.addSql(`create table if not exists "blog_settings" ("id" text not null, "section_name" text not null default 'Blog', "show_search" boolean not null default true, "show_categories" boolean not null default true, "posts_per_page" integer not null default 12, "default_seo_title" text null, "default_seo_description" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "blog_settings_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_settings_deleted_at" ON "blog_settings" ("deleted_at") WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop table if exists "blog_post" cascade;`);
        this.addSql(`drop table if exists "blog_category" cascade;`);
        this.addSql(`drop table if exists "blog_post_product" cascade;`);
        this.addSql(`drop table if exists "blog_settings" cascade;`);
    }
}
exports.Migration20260616150000 = Migration20260616150000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MTYxNTAwMDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9ibG9nL21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA2MTYxNTAwMDAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUVBQXFFO0FBRXJFLE1BQWEsdUJBQXdCLFNBQVEsc0JBQVM7SUFDM0MsS0FBSyxDQUFDLEVBQUU7UUFDZixZQUFZO1FBQ1osSUFBSSxDQUFDLE1BQU0sQ0FDVCw4Z0JBQThnQixDQUMvZ0IsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsaUhBQWlILENBQ2xILENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULHVHQUF1RyxDQUN4RyxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCxpSEFBaUgsQ0FDbEgsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsbUhBQW1ILENBQ3BILENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULG9IQUFvSCxDQUNySCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCwrR0FBK0csQ0FDaEgsQ0FBQztRQUVGLGdCQUFnQjtRQUNoQixJQUFJLENBQUMsTUFBTSxDQUNULHlYQUF5WCxDQUMxWCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCx5SEFBeUgsQ0FDMUgsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsdUhBQXVILENBQ3hILENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULHVIQUF1SCxDQUN4SCxDQUFDO1FBRUYsb0JBQW9CO1FBQ3BCLElBQUksQ0FBQyxNQUFNLENBQ1Qsa1dBQWtXLENBQ25XLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULDJIQUEySCxDQUM1SCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCxrSkFBa0osQ0FDbkosQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsK0hBQStILENBQ2hJLENBQUM7UUFFRiw0QkFBNEI7UUFDNUIsSUFBSSxDQUFDLE1BQU0sQ0FDVCwyZ0JBQTJnQixDQUM1Z0IsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsdUhBQXVILENBQ3hILENBQUM7SUFDSixDQUFDO0lBRVEsS0FBSyxDQUFDLElBQUk7UUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO1FBQ3pELElBQUksQ0FBQyxNQUFNLENBQUMsK0NBQStDLENBQUMsQ0FBQztRQUM3RCxJQUFJLENBQUMsTUFBTSxDQUFDLG1EQUFtRCxDQUFDLENBQUM7UUFDakUsSUFBSSxDQUFDLE1BQU0sQ0FBQywrQ0FBK0MsQ0FBQyxDQUFDO0lBQy9ELENBQUM7Q0FDRjtBQXBFRCwwREFvRUMifQ==