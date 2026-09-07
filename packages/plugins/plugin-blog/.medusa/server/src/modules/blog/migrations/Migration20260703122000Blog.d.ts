import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * Adds `sales_channel_ids` (JSON array) to blog_post for per-sales-channel
 * segmentation. null/[] = visible in all channels (backwards compatible).
 * Idempotent.
 */
export declare class Migration20260703122000Blog extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
