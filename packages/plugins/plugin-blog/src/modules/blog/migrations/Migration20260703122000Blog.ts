import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Adds `sales_channel_ids` (JSON array) to blog_post for per-sales-channel
 * segmentation. null/[] = visible in all channels (backwards compatible).
 * Idempotent.
 */
export class Migration20260703122000Blog extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "blog_post" add column if not exists "sales_channel_ids" jsonb null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "blog_post" drop column if exists "sales_channel_ids";`
    );
  }
}
