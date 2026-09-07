"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260703121000Brand = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * Adds `sales_channel_ids` (JSON array) to brand for per-sales-channel
 * segmentation. null/[] = visible in all channels (backwards compatible).
 * Idempotent.
 */
class Migration20260703121000Brand extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "brand" add column if not exists "sales_channel_ids" jsonb null;`);
    }
    async down() {
        this.addSql(`alter table if exists "brand" drop column if exists "sales_channel_ids";`);
    }
}
exports.Migration20260703121000Brand = Migration20260703121000Brand;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MDMxMjEwMDBCcmFuZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2JyYW5kL21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA3MDMxMjEwMDBCcmFuZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7R0FJRztBQUNILE1BQWEsNEJBQTZCLFNBQVEsc0JBQVM7SUFDaEQsS0FBSyxDQUFDLEVBQUU7UUFDZixJQUFJLENBQUMsTUFBTSxDQUNULHdGQUF3RixDQUN6RixDQUFDO0lBQ0osQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQ1QsMEVBQTBFLENBQzNFLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFaRCxvRUFZQyJ9