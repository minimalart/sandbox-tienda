"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260703122000Blog = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * Adds `sales_channel_ids` (JSON array) to blog_post for per-sales-channel
 * segmentation. null/[] = visible in all channels (backwards compatible).
 * Idempotent.
 */
class Migration20260703122000Blog extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "blog_post" add column if not exists "sales_channel_ids" jsonb null;`);
    }
    async down() {
        this.addSql(`alter table if exists "blog_post" drop column if exists "sales_channel_ids";`);
    }
}
exports.Migration20260703122000Blog = Migration20260703122000Blog;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MDMxMjIwMDBCbG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvYmxvZy9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwNzAzMTIyMDAwQmxvZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7R0FJRztBQUNILE1BQWEsMkJBQTRCLFNBQVEsc0JBQVM7SUFDL0MsS0FBSyxDQUFDLEVBQUU7UUFDZixJQUFJLENBQUMsTUFBTSxDQUNULDRGQUE0RixDQUM3RixDQUFDO0lBQ0osQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQ1QsOEVBQThFLENBQy9FLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFaRCxrRUFZQyJ9