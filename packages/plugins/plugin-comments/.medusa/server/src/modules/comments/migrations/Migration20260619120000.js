"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260619120000 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260619120000 extends migrations_1.Migration {
    async up() {
        // comment
        this.addSql(`create table if not exists "comment" ("id" text not null, "commentable_type" text check ("commentable_type" in ('product', 'blog_post')) not null, "commentable_id" text not null, "parent_id" text null, "customer_id" text not null, "author_name" text null, "rating" integer null, "content" text null, "status" text check ("status" in ('pending', 'approved', 'hidden', 'deleted')) not null default 'pending', "verified_buyer" boolean not null default false, "edited_at" timestamptz null, "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "comment_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_comment_commentable_status" ON "comment" ("commentable_type", "commentable_id", "status") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_comment_parent_id" ON "comment" ("parent_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_comment_customer_id" ON "comment" ("customer_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_comment_deleted_at" ON "comment" ("deleted_at") WHERE deleted_at IS NULL;`);
        // comment_settings (singleton)
        this.addSql(`create table if not exists "comment_settings" ("id" text not null, "enabled" boolean not null default true, "review_mode" text check ("review_mode" in ('comment', 'rating', 'both')) not null default 'both', "rating_scale" integer not null default 5, "who_can_comment" text check ("who_can_comment" in ('registered', 'verified_buyer')) not null default 'registered', "moderation" text check ("moderation" in ('auto', 'manual')) not null default 'auto', "edit_window_minutes" integer not null default 15, "min_length" integer not null default 5, "max_length" integer not null default 2000, "rate_limit_per_minute" integer not null default 5, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "comment_settings_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_comment_settings_deleted_at" ON "comment_settings" ("deleted_at") WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop table if exists "comment" cascade;`);
        this.addSql(`drop table if exists "comment_settings" cascade;`);
    }
}
exports.Migration20260619120000 = Migration20260619120000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MTkxMjAwMDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9jb21tZW50cy9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwNjE5MTIwMDAwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlFQUFxRTtBQUVyRSxNQUFhLHVCQUF3QixTQUFRLHNCQUFTO0lBQzNDLEtBQUssQ0FBQyxFQUFFO1FBQ2YsVUFBVTtRQUNWLElBQUksQ0FBQyxNQUFNLENBQ1Qsd3JCQUF3ckIsQ0FDenJCLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULHFKQUFxSixDQUN0SixDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCx5R0FBeUcsQ0FDMUcsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsNkdBQTZHLENBQzlHLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULDJHQUEyRyxDQUM1RyxDQUFDO1FBRUYsK0JBQStCO1FBQy9CLElBQUksQ0FBQyxNQUFNLENBQ1QsMHpCQUEwekIsQ0FDM3pCLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULDZIQUE2SCxDQUM5SCxDQUFDO0lBQ0osQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMseUNBQXlDLENBQUMsQ0FBQztRQUN2RCxJQUFJLENBQUMsTUFBTSxDQUFDLGtEQUFrRCxDQUFDLENBQUM7SUFDbEUsQ0FBQztDQUNGO0FBaENELDBEQWdDQyJ9