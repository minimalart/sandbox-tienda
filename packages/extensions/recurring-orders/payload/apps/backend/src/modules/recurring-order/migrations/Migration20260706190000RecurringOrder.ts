import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Tabla `recurring_setting`: elegibilidad de productos para compras
 * recurrentes por sales channel (fila con sales_channel_id null = default
 * global). `scope: 'all' | 'selected'` + criterios (categorías / tags /
 * productos) como jsonb. Idempotente según la convención del repo.
 */
export class Migration20260706190000RecurringOrder extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "recurring_setting" (
        "id"               TEXT        NOT NULL,
        "sales_channel_id" TEXT,
        "scope"            TEXT        NOT NULL DEFAULT 'all',
        "category_ids"     JSONB,
        "tag_values"       JSONB,
        "product_ids"      JSONB,
        "metadata"         JSONB,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        CONSTRAINT "recurring_setting_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_setting_sales_channel_id" ON "recurring_setting" ("sales_channel_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_setting_deleted_at" ON "recurring_setting" ("deleted_at");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "recurring_setting";`);
  }
}
