import { Migration } from '@mikro-orm/migrations';

export class Migration20260612100000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "minimum_purchase" (
        "id"            TEXT         NOT NULL,
        "amount"        INTEGER      NOT NULL,
        "currency_code" TEXT         NOT NULL DEFAULT 'ars',
        "starts_at"     TIMESTAMPTZ  NOT NULL,
        "ends_at"       TIMESTAMPTZ,
        "note"          TEXT,
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMPTZ,
        CONSTRAINT "minimum_purchase_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_minimum_purchase_starts_at" ON "minimum_purchase" ("starts_at");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_minimum_purchase_deleted_at" ON "minimum_purchase" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "minimum_purchase";`);
  }
}
