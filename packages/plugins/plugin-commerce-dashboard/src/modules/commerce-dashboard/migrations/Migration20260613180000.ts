import { Migration } from '@mikro-orm/migrations';

export class Migration20260613180000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "commerce_metrics_daily" (
        "id" TEXT NOT NULL,
        "bucket" TEXT NOT NULL DEFAULT 'daily',
        "period_start" TIMESTAMPTZ NOT NULL,
        "period_end" TIMESTAMPTZ NOT NULL,
        "sales_channel_id" TEXT,
        "country_code" TEXT,
        "currency_code" TEXT NOT NULL,
        "revenue" NUMERIC NOT NULL DEFAULT 0,
        "orders" INTEGER NOT NULL DEFAULT 0,
        "aov" NUMERIC NOT NULL DEFAULT 0,
        "units_sold" INTEGER NOT NULL DEFAULT 0,
        "new_customers" INTEGER NOT NULL DEFAULT 0,
        "returning_customers" INTEGER NOT NULL DEFAULT 0,
        "refunds" NUMERIC NOT NULL DEFAULT 0,
        "conversion_proxy" NUMERIC NOT NULL DEFAULT 0,
        "repeat_purchase_rate" NUMERIC NOT NULL DEFAULT 0,
        "metadata" JSONB,
        "aggregated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "commerce_metrics_daily_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "product_metrics_daily" (
        "id" TEXT NOT NULL,
        "bucket" TEXT NOT NULL DEFAULT 'daily',
        "period_start" TIMESTAMPTZ NOT NULL,
        "period_end" TIMESTAMPTZ NOT NULL,
        "sales_channel_id" TEXT,
        "country_code" TEXT,
        "currency_code" TEXT NOT NULL,
        "product_id" TEXT NOT NULL,
        "product_title" TEXT,
        "product_handle" TEXT,
        "collection_id" TEXT,
        "collection_title" TEXT,
        "category_id" TEXT,
        "category_name" TEXT,
        "revenue" NUMERIC NOT NULL DEFAULT 0,
        "orders" INTEGER NOT NULL DEFAULT 0,
        "units_sold" INTEGER NOT NULL DEFAULT 0,
        "refunds" NUMERIC NOT NULL DEFAULT 0,
        "metadata" JSONB,
        "aggregated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "product_metrics_daily_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "collection_metrics_daily" (
        "id" TEXT NOT NULL,
        "bucket" TEXT NOT NULL DEFAULT 'daily',
        "period_start" TIMESTAMPTZ NOT NULL,
        "period_end" TIMESTAMPTZ NOT NULL,
        "sales_channel_id" TEXT,
        "country_code" TEXT,
        "currency_code" TEXT NOT NULL,
        "collection_id" TEXT,
        "collection_title" TEXT,
        "category_id" TEXT,
        "category_name" TEXT,
        "revenue" NUMERIC NOT NULL DEFAULT 0,
        "orders" INTEGER NOT NULL DEFAULT 0,
        "units_sold" INTEGER NOT NULL DEFAULT 0,
        "refunds" NUMERIC NOT NULL DEFAULT 0,
        "metadata" JSONB,
        "aggregated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "collection_metrics_daily_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "customer_metrics_daily" (
        "id" TEXT NOT NULL,
        "bucket" TEXT NOT NULL DEFAULT 'daily',
        "period_start" TIMESTAMPTZ NOT NULL,
        "period_end" TIMESTAMPTZ NOT NULL,
        "sales_channel_id" TEXT,
        "country_code" TEXT,
        "currency_code" TEXT NOT NULL,
        "new_customers" INTEGER NOT NULL DEFAULT 0,
        "returning_customers" INTEGER NOT NULL DEFAULT 0,
        "customers_with_orders" INTEGER NOT NULL DEFAULT 0,
        "repeat_customers" INTEGER NOT NULL DEFAULT 0,
        "repeat_purchase_rate" NUMERIC NOT NULL DEFAULT 0,
        "metadata" JSONB,
        "aggregated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "customer_metrics_daily_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cmd_range" ON "commerce_metrics_daily" ("bucket", "period_start", "currency_code") WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cmd_filters" ON "commerce_metrics_daily" ("sales_channel_id", "country_code", "currency_code", "period_start") WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cmd_snapshot" ON "commerce_metrics_daily" ("bucket", "period_start", COALESCE("sales_channel_id", ''), COALESCE("country_code", ''), "currency_code") WHERE "deleted_at" IS NULL;`);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pmd_range" ON "product_metrics_daily" ("bucket", "period_start", "currency_code") WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pmd_top" ON "product_metrics_daily" ("bucket", "currency_code", "period_start", "revenue" DESC) WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_pmd_snapshot" ON "product_metrics_daily" ("bucket", "period_start", COALESCE("sales_channel_id", ''), COALESCE("country_code", ''), "currency_code", "product_id") WHERE "deleted_at" IS NULL;`);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_colmd_range" ON "collection_metrics_daily" ("bucket", "period_start", "currency_code") WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_colmd_collection_top" ON "collection_metrics_daily" ("bucket", "currency_code", "period_start", "revenue" DESC) WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_colmd_category_top" ON "collection_metrics_daily" ("category_id", "period_start", "revenue" DESC) WHERE "deleted_at" IS NULL;`);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cumd_range" ON "customer_metrics_daily" ("bucket", "period_start", "currency_code") WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cumd_snapshot" ON "customer_metrics_daily" ("bucket", "period_start", COALESCE("sales_channel_id", ''), COALESCE("country_code", ''), "currency_code") WHERE "deleted_at" IS NULL;`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "customer_metrics_daily";`);
    this.addSql(`DROP TABLE IF EXISTS "collection_metrics_daily";`);
    this.addSql(`DROP TABLE IF EXISTS "product_metrics_daily";`);
    this.addSql(`DROP TABLE IF EXISTS "commerce_metrics_daily";`);
  }
}
