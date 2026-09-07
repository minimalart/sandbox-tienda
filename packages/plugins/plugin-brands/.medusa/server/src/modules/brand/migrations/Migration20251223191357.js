"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20251223191357 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20251223191357 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "brand" drop constraint if exists "brand_handle_unique";`);
        this.addSql(`create table if not exists "brand" ("id" text not null, "name" text not null, "handle" text not null, "description" text null, "is_active" boolean not null default true, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "brand_pkey" primary key ("id"));`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_handle_unique" ON "brand" ("handle") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_brand_deleted_at" ON "brand" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`create table if not exists "brand_image" ("id" text not null, "url" text not null, "file_id" text not null, "type" text check ("type" in ('thumbnail', 'image')) not null, "brand_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "brand_image_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_brand_image_deleted_at" ON "brand_image" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "unique_thumbnail_per_brand" ON "brand_image" ("brand_id", "type") WHERE type = 'thumbnail' AND deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop table if exists "brand" cascade;`);
        this.addSql(`drop table if exists "brand_image" cascade;`);
    }
}
exports.Migration20251223191357 = Migration20251223191357;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNTEyMjMxOTEzNTcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9icmFuZC9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjUxMjIzMTkxMzU3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlFQUFxRTtBQUVyRSxNQUFhLHVCQUF3QixTQUFRLHNCQUFTO0lBQzNDLEtBQUssQ0FBQyxFQUFFO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnRkFBZ0YsQ0FBQyxDQUFDO1FBQzlGLElBQUksQ0FBQyxNQUFNLENBQ1QsZ1hBQWdYLENBQ2pYLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULDZHQUE2RyxDQUM5RyxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCx1R0FBdUcsQ0FDeEcsQ0FBQztRQUVGLElBQUksQ0FBQyxNQUFNLENBQ1QsMFhBQTBYLENBQzNYLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULG1IQUFtSCxDQUNwSCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCx1SkFBdUosQ0FDeEosQ0FBQztJQUNKLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLHVDQUF1QyxDQUFDLENBQUM7UUFFckQsSUFBSSxDQUFDLE1BQU0sQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFDO0lBQzdELENBQUM7Q0FDRjtBQTdCRCwwREE2QkMifQ==