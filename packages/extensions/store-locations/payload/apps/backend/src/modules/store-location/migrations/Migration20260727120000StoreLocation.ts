import { Migration } from '@mikro-orm/migrations';

/**
 * Adds `sales_channel_ids` to store_location: scopes the PUBLIC visibility of a
 * branch to a set of sales channels. null/[] = global (visible everywhere), so
 * existing rows keep their current behaviour and no backfill is needed.
 *
 * This is NOT the operational channel↔branch ownership (that lives in the
 * `store_location_sales_channel` link table).
 */
export class Migration20260727120000StoreLocation extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE IF EXISTS "store_location" ADD COLUMN IF NOT EXISTS "sales_channel_ids" JSONB;`,
    );
  }

  async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE IF EXISTS "store_location" DROP COLUMN IF EXISTS "sales_channel_ids";`,
    );
  }
}
