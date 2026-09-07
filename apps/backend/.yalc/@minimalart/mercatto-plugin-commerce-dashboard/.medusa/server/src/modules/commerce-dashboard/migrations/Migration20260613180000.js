"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260613180000 = void 0;
const migrations_1 = require("@mikro-orm/migrations");
class Migration20260613180000 extends migrations_1.Migration {
    async up() {
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
    async down() {
        this.addSql(`DROP TABLE IF EXISTS "customer_metrics_daily";`);
        this.addSql(`DROP TABLE IF EXISTS "collection_metrics_daily";`);
        this.addSql(`DROP TABLE IF EXISTS "product_metrics_daily";`);
        this.addSql(`DROP TABLE IF EXISTS "commerce_metrics_daily";`);
    }
}
exports.Migration20260613180000 = Migration20260613180000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MTMxODAwMDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9jb21tZXJjZS1kYXNoYm9hcmQvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDYxMzE4MDAwMC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxzREFBa0Q7QUFFbEQsTUFBYSx1QkFBd0IsU0FBUSxzQkFBUztJQUNwRCxLQUFLLENBQUMsRUFBRTtRQUNOLElBQUksQ0FBQyxNQUFNLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7S0F5QlgsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLE1BQU0sQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0tBMkJYLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxNQUFNLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztLQXdCWCxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsTUFBTSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7S0FxQlgsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnSkFBZ0osQ0FBQyxDQUFDO1FBQzlKLElBQUksQ0FBQyxNQUFNLENBQUMsNEtBQTRLLENBQUMsQ0FBQztRQUMxTCxJQUFJLENBQUMsTUFBTSxDQUFDLHlOQUF5TixDQUFDLENBQUM7UUFFdk8sSUFBSSxDQUFDLE1BQU0sQ0FBQywrSUFBK0ksQ0FBQyxDQUFDO1FBQzdKLElBQUksQ0FBQyxNQUFNLENBQUMsNkpBQTZKLENBQUMsQ0FBQztRQUMzSyxJQUFJLENBQUMsTUFBTSxDQUFDLHNPQUFzTyxDQUFDLENBQUM7UUFFcFAsSUFBSSxDQUFDLE1BQU0sQ0FBQyxvSkFBb0osQ0FBQyxDQUFDO1FBQ2xLLElBQUksQ0FBQyxNQUFNLENBQUMsNktBQTZLLENBQUMsQ0FBQztRQUMzTCxJQUFJLENBQUMsTUFBTSxDQUFDLCtKQUErSixDQUFDLENBQUM7UUFFN0ssSUFBSSxDQUFDLE1BQU0sQ0FBQyxpSkFBaUosQ0FBQyxDQUFDO1FBQy9KLElBQUksQ0FBQyxNQUFNLENBQUMsME5BQTBOLENBQUMsQ0FBQztJQUMxTyxDQUFDO0lBRUQsS0FBSyxDQUFDLElBQUk7UUFDUixJQUFJLENBQUMsTUFBTSxDQUFDLGdEQUFnRCxDQUFDLENBQUM7UUFDOUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO1FBQ2hFLElBQUksQ0FBQyxNQUFNLENBQUMsK0NBQStDLENBQUMsQ0FBQztRQUM3RCxJQUFJLENBQUMsTUFBTSxDQUFDLGdEQUFnRCxDQUFDLENBQUM7SUFDaEUsQ0FBQztDQUNGO0FBaklELDBEQWlJQyJ9