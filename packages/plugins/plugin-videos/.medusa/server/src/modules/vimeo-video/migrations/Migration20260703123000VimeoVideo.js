"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260703123000VimeoVideo = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * Adds `sales_channel_ids` (JSON array) to vimeo_video for per-sales-channel
 * segmentation. null/[] = visible in all channels (backwards compatible).
 * Idempotent.
 */
class Migration20260703123000VimeoVideo extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "vimeo_video" add column if not exists "sales_channel_ids" jsonb null;`);
    }
    async down() {
        this.addSql(`alter table if exists "vimeo_video" drop column if exists "sales_channel_ids";`);
    }
}
exports.Migration20260703123000VimeoVideo = Migration20260703123000VimeoVideo;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MDMxMjMwMDBWaW1lb1ZpZGVvLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvdmltZW8tdmlkZW8vbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDcwMzEyMzAwMFZpbWVvVmlkZW8udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUVBQXFFO0FBRXJFOzs7O0dBSUc7QUFDSCxNQUFhLGlDQUFrQyxTQUFRLHNCQUFTO0lBQ3JELEtBQUssQ0FBQyxFQUFFO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FDVCw4RkFBOEYsQ0FDL0YsQ0FBQztJQUNKLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUNULGdGQUFnRixDQUNqRixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBWkQsOEVBWUMifQ==