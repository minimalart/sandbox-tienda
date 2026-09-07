"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260203143100 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260203143100 extends migrations_1.Migration {
    async up() {
        this.addSql(`create table if not exists "product_product_brand_brand" ("id" text not null, "product_id" text not null, "brand_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_product_brand_brand_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_brand_link_product_id" ON "product_product_brand_brand" ("product_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_brand_link_brand_id" ON "product_product_brand_brand" ("brand_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_brand_link_deleted_at" ON "product_product_brand_brand" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_brand_link_unique" ON "product_product_brand_brand" ("product_id", "brand_id") WHERE deleted_at IS NULL;`);
        this.addSql(`ALTER TABLE "product_product_brand_brand" ADD CONSTRAINT "product_product_brand_brand_brand_id_foreign" FOREIGN KEY ("brand_id") REFERENCES "brand" ("id") ON UPDATE CASCADE ON DELETE CASCADE;`);
    }
    async down() {
        this.addSql(`drop table if exists "product_product_brand_brand" cascade;`);
    }
}
exports.Migration20260203143100 = Migration20260203143100;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjAyMDMxNDMxMDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9icmFuZC9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwMjAzMTQzMTAwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlFQUFxRTtBQUVyRSxNQUFhLHVCQUF3QixTQUFRLHNCQUFTO0lBQzNDLEtBQUssQ0FBQyxFQUFFO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FDVCx5VUFBeVUsQ0FDMVUsQ0FBQztRQUVGLElBQUksQ0FBQyxNQUFNLENBQ1QsMElBQTBJLENBQzNJLENBQUM7UUFFRixJQUFJLENBQUMsTUFBTSxDQUNULHNJQUFzSSxDQUN2SSxDQUFDO1FBRUYsSUFBSSxDQUFDLE1BQU0sQ0FDVCwwSUFBMEksQ0FDM0ksQ0FBQztRQUVGLElBQUksQ0FBQyxNQUFNLENBQ1QseUpBQXlKLENBQzFKLENBQUM7UUFFRixJQUFJLENBQUMsTUFBTSxDQUNULGlNQUFpTSxDQUNsTSxDQUFDO0lBQ0osQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMsNkRBQTZELENBQUMsQ0FBQztJQUM3RSxDQUFDO0NBQ0Y7QUE5QkQsMERBOEJDIn0=