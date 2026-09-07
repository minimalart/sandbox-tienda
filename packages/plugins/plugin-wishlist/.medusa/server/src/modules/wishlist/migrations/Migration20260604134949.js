"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260604134949 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260604134949 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "wishlist_item" drop constraint if exists "wishlist_item_wishlist_id_product_id_unique";`);
        this.addSql(`alter table if exists "wishlist" drop constraint if exists "wishlist_customer_id_unique";`);
        this.addSql(`create table if not exists "wishlist" ("id" text not null, "customer_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "wishlist_pkey" primary key ("id"));`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wishlist_customer_id_unique" ON "wishlist" ("customer_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wishlist_deleted_at" ON "wishlist" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`create table if not exists "wishlist_item" ("id" text not null, "product_id" text not null, "wishlist_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "wishlist_item_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wishlist_item_wishlist_id" ON "wishlist_item" ("wishlist_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wishlist_item_deleted_at" ON "wishlist_item" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wishlist_item_wishlist_id_product_id_unique" ON "wishlist_item" ("wishlist_id", "product_id") WHERE deleted_at IS NULL;`);
        this.addSql(`alter table if exists "wishlist_item" add constraint "wishlist_item_wishlist_id_foreign" foreign key ("wishlist_id") references "wishlist" ("id") on update cascade;`);
    }
    async down() {
        this.addSql(`alter table if exists "wishlist_item" drop constraint if exists "wishlist_item_wishlist_id_foreign";`);
        this.addSql(`drop table if exists "wishlist" cascade;`);
        this.addSql(`drop table if exists "wishlist_item" cascade;`);
    }
}
exports.Migration20260604134949 = Migration20260604134949;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MDQxMzQ5NDkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy93aXNobGlzdC9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwNjA0MTM0OTQ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlFQUFxRTtBQUVyRSxNQUFhLHVCQUF3QixTQUFRLHNCQUFTO0lBRTNDLEtBQUssQ0FBQyxFQUFFO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnSEFBZ0gsQ0FBQyxDQUFDO1FBQzlILElBQUksQ0FBQyxNQUFNLENBQUMsMkZBQTJGLENBQUMsQ0FBQztRQUN6RyxJQUFJLENBQUMsTUFBTSxDQUFDLDBRQUEwUSxDQUFDLENBQUM7UUFDeFIsSUFBSSxDQUFDLE1BQU0sQ0FBQyw2SEFBNkgsQ0FBQyxDQUFDO1FBQzNJLElBQUksQ0FBQyxNQUFNLENBQUMsNkdBQTZHLENBQUMsQ0FBQztRQUUzSCxJQUFJLENBQUMsTUFBTSxDQUFDLGdUQUFnVCxDQUFDLENBQUM7UUFDOVQsSUFBSSxDQUFDLE1BQU0sQ0FBQyx5SEFBeUgsQ0FBQyxDQUFDO1FBQ3ZJLElBQUksQ0FBQyxNQUFNLENBQUMsdUhBQXVILENBQUMsQ0FBQztRQUNySSxJQUFJLENBQUMsTUFBTSxDQUFDLGdLQUFnSyxDQUFDLENBQUM7UUFFOUssSUFBSSxDQUFDLE1BQU0sQ0FBQyxzS0FBc0ssQ0FBQyxDQUFDO0lBQ3RMLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLHNHQUFzRyxDQUFDLENBQUM7UUFFcEgsSUFBSSxDQUFDLE1BQU0sQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO1FBRXhELElBQUksQ0FBQyxNQUFNLENBQUMsK0NBQStDLENBQUMsQ0FBQztJQUMvRCxDQUFDO0NBRUY7QUF6QkQsMERBeUJDIn0=