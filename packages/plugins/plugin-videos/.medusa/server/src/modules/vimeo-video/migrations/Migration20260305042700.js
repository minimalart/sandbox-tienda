"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260305042700 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260305042700 extends migrations_1.Migration {
    async up() {
        // Drop the old constraint
        this.addSql(`alter table "vimeo_video" drop constraint if exists "vimeo_video_status_check";`);
        // Add new constraint with all Vimeo status values
        this.addSql(`alter table "vimeo_video" add constraint "vimeo_video_status_check" check ("status" in ('uploading', 'transcoding', 'processing', 'available', 'error', 'quota_exceeded', 'total_cap_exceeded', 'transcode_starting', 'unavailable'));`);
    }
    async down() {
        this.addSql(`alter table "vimeo_video" drop constraint if exists "vimeo_video_status_check";`);
        this.addSql(`alter table "vimeo_video" add constraint "vimeo_video_status_check" check ("status" in ('uploading', 'processing', 'available', 'error'));`);
    }
}
exports.Migration20260305042700 = Migration20260305042700;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjAzMDUwNDI3MDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy92aW1lby12aWRlby9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwMzA1MDQyNzAwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlFQUFxRTtBQUVyRSxNQUFhLHVCQUF3QixTQUFRLHNCQUFTO0lBQzNDLEtBQUssQ0FBQyxFQUFFO1FBQ2YsMEJBQTBCO1FBQzFCLElBQUksQ0FBQyxNQUFNLENBQUMsaUZBQWlGLENBQUMsQ0FBQztRQUUvRixrREFBa0Q7UUFDbEQsSUFBSSxDQUFDLE1BQU0sQ0FDVCx3T0FBd08sQ0FDek8sQ0FBQztJQUNKLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLGlGQUFpRixDQUFDLENBQUM7UUFDL0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCw0SUFBNEksQ0FDN0ksQ0FBQztJQUNKLENBQUM7Q0FDRjtBQWpCRCwwREFpQkMifQ==