import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Ofertas de suscripción: tabla `recurring_offer` (override de descuento por
 * producto) + columna `frequency_discounts` en `recurring_setting` (% por
 * frecuencia a nivel canal). Idempotente según la convención del repo.
 */
export class Migration20260721120000RecurringOrder extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "recurring_offer" (
        "id"               TEXT        NOT NULL,
        "sales_channel_id" TEXT,
        "product_id"       TEXT        NOT NULL,
        "discounts"        JSONB       NOT NULL DEFAULT '[]'::jsonb,
        "enabled"          BOOLEAN     NOT NULL DEFAULT TRUE,
        "metadata"         JSONB,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        CONSTRAINT "recurring_offer_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_offer_product_id" ON "recurring_offer" ("product_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_offer_sales_channel_id" ON "recurring_offer" ("sales_channel_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_offer_deleted_at" ON "recurring_offer" ("deleted_at");`,
    );
    this.addSql(
      `ALTER TABLE IF EXISTS "recurring_setting" ADD COLUMN IF NOT EXISTS "frequency_discounts" JSONB;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "recurring_offer";`);
    this.addSql(
      `ALTER TABLE IF EXISTS "recurring_setting" DROP COLUMN IF EXISTS "frequency_discounts";`,
    );
  }
}
