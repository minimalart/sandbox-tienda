import { Migration } from '@mikro-orm/migrations';

/**
 * Phase 0 — turns StoreLocation into the operational Branch:
 *  - `active`: operational status (separate from public `is_visible`).
 *  - `stock_location_id`: the Medusa inventory location the branch ships from.
 */
export class Migration20260617000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE IF EXISTS "store_location" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT TRUE;`,
    );
    this.addSql(
      `ALTER TABLE IF EXISTS "store_location" ADD COLUMN IF NOT EXISTS "stock_location_id" TEXT;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_store_location_active_deleted_at" ON "store_location" ("active", "deleted_at");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_store_location_stock_location_id" ON "store_location" ("stock_location_id");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_store_location_active_deleted_at";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_store_location_stock_location_id";`);
    this.addSql(`ALTER TABLE IF EXISTS "store_location" DROP COLUMN IF EXISTS "active";`);
    this.addSql(`ALTER TABLE IF EXISTS "store_location" DROP COLUMN IF EXISTS "stock_location_id";`);
  }
}
