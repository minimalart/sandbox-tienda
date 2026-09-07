"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260604140711 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260604140711 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "wishlist_item" drop constraint if exists "wishlist_item_wishlist_id_product_id_product_variant_id_unique";`);
        this.addSql(`drop index if exists "IDX_wishlist_item_wishlist_id_product_id_unique";`);
        this.addSql(`alter table if exists "wishlist_item" add column if not exists "product_variant_id" text not null, add column if not exists "quantity" integer not null default 1;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wishlist_item_wishlist_id_product_id_product_variant_id_unique" ON "wishlist_item" ("wishlist_id", "product_id", "product_variant_id") WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop index if exists "IDX_wishlist_item_wishlist_id_product_id_product_variant_id_unique";`);
        this.addSql(`alter table if exists "wishlist_item" drop column if exists "product_variant_id", drop column if exists "quantity";`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wishlist_item_wishlist_id_product_id_unique" ON "wishlist_item" ("wishlist_id", "product_id") WHERE deleted_at IS NULL;`);
    }
}
exports.Migration20260604140711 = Migration20260604140711;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MDQxNDA3MTEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy93aXNobGlzdC9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwNjA0MTQwNzExLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlFQUFxRTtBQUVyRSxNQUFhLHVCQUF3QixTQUFRLHNCQUFTO0lBRTNDLEtBQUssQ0FBQyxFQUFFO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtSUFBbUksQ0FBQyxDQUFDO1FBQ2pKLElBQUksQ0FBQyxNQUFNLENBQUMseUVBQXlFLENBQUMsQ0FBQztRQUV2RixJQUFJLENBQUMsTUFBTSxDQUFDLG9LQUFvSyxDQUFDLENBQUM7UUFDbEwsSUFBSSxDQUFDLE1BQU0sQ0FBQyx5TUFBeU0sQ0FBQyxDQUFDO0lBQ3pOLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLDRGQUE0RixDQUFDLENBQUM7UUFDMUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxxSEFBcUgsQ0FBQyxDQUFDO1FBRW5JLElBQUksQ0FBQyxNQUFNLENBQUMsZ0tBQWdLLENBQUMsQ0FBQztJQUNoTCxDQUFDO0NBRUY7QUFqQkQsMERBaUJDIn0=