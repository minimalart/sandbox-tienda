import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Adds `sales_channel_ids` (JSON array) to vimeo_video for per-sales-channel
 * segmentation. null/[] = visible in all channels (backwards compatible).
 * Idempotent.
 */
export class Migration20260703123000VimeoVideo extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "vimeo_video" add column if not exists "sales_channel_ids" jsonb null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "vimeo_video" drop column if exists "sales_channel_ids";`
    );
  }
}
