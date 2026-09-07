import { Migration } from '@mikro-orm/migrations';

/**
 * Generic key/value store settings (e.g. multi_branch_enabled), managed from the
 * admin "Preferencias" screen.
 */
export class Migration20260617000003 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "store_setting" (
        "id"         TEXT         NOT NULL,
        "key"        TEXT         NOT NULL,
        "value"      JSONB,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "store_setting_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_store_setting_key_unique" ON "store_setting" ("key") WHERE deleted_at IS NULL;`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "store_setting";`);
  }
}
