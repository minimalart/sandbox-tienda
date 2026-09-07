import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * Adds `sales_channel_ids` (JSON array) to brand for per-sales-channel
 * segmentation. null/[] = visible in all channels (backwards compatible).
 * Idempotent.
 */
export declare class Migration20260703121000Brand extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
