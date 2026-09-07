import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260305042700 extends Migration {
  override async up(): Promise<void> {
    // Drop the old constraint
    this.addSql(`alter table "vimeo_video" drop constraint if exists "vimeo_video_status_check";`);

    // Add new constraint with all Vimeo status values
    this.addSql(
      `alter table "vimeo_video" add constraint "vimeo_video_status_check" check ("status" in ('uploading', 'transcoding', 'processing', 'available', 'error', 'quota_exceeded', 'total_cap_exceeded', 'transcode_starting', 'unavailable'));`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "vimeo_video" drop constraint if exists "vimeo_video_status_check";`);
    this.addSql(
      `alter table "vimeo_video" add constraint "vimeo_video_status_check" check ("status" in ('uploading', 'processing', 'available', 'error'));`
    );
  }
}
