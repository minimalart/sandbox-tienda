"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260706120000AbandonedCart = void 0;
const migrations_1 = require("@mikro-orm/migrations");
class Migration20260706120000AbandonedCart extends migrations_1.Migration {
    async up() {
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "abandoned_cart" (
        "id"                 TEXT        NOT NULL,
        "cart_id"            TEXT        NOT NULL,
        "email"              TEXT,
        "phone"              TEXT,
        "customer_id"        TEXT,
        "sales_channel_id"   TEXT,
        "cart_total"         NUMERIC,
        "currency_code"      TEXT,
        "status"             TEXT        NOT NULL DEFAULT 'pending',
        "last_step_sent"     INTEGER     NOT NULL DEFAULT 0,
        "next_eligible_at"   TIMESTAMPTZ,
        "last_activity_at"   TIMESTAMPTZ,
        "recovered_order_id" TEXT,
        "metadata"           JSONB,
        "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMPTZ,
        CONSTRAINT "abandoned_cart_pkey" PRIMARY KEY ("id")
      );
    `);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_abandoned_cart_cart_id" ON "abandoned_cart" ("cart_id") WHERE "deleted_at" IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_abandoned_cart_status" ON "abandoned_cart" ("status") WHERE "deleted_at" IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_abandoned_cart_next_eligible_at" ON "abandoned_cart" ("next_eligible_at") WHERE "deleted_at" IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_abandoned_cart_deleted_at" ON "abandoned_cart" ("deleted_at");`);
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "abandoned_cart_notification" (
        "id"                TEXT        NOT NULL,
        "abandoned_cart_id" TEXT        NOT NULL,
        "step"              INTEGER     NOT NULL,
        "channel"           TEXT        NOT NULL,
        "template"          TEXT,
        "recipient"         TEXT,
        "status"            TEXT        NOT NULL DEFAULT 'sent',
        "error"             TEXT,
        "sent_at"           TIMESTAMPTZ,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "abandoned_cart_notification_pkey" PRIMARY KEY ("id")
      );
    `);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_abandoned_cart_notification_cart" ON "abandoned_cart_notification" ("abandoned_cart_id");`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_abandoned_cart_notification_step_channel" ON "abandoned_cart_notification" ("abandoned_cart_id", "step", "channel") WHERE "deleted_at" IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_abandoned_cart_notification_deleted_at" ON "abandoned_cart_notification" ("deleted_at");`);
    }
    async down() {
        this.addSql(`DROP TABLE IF EXISTS "abandoned_cart_notification";`);
        this.addSql(`DROP TABLE IF EXISTS "abandoned_cart";`);
    }
}
exports.Migration20260706120000AbandonedCart = Migration20260706120000AbandonedCart;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MDYxMjAwMDBBYmFuZG9uZWRDYXJ0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvYWJhbmRvbmVkLWNhcnQvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDcwNjEyMDAwMEFiYW5kb25lZENhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsc0RBQWtEO0FBRWxELE1BQWEsb0NBQXFDLFNBQVEsc0JBQVM7SUFDakUsS0FBSyxDQUFDLEVBQUU7UUFDTixJQUFJLENBQUMsTUFBTSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7S0FxQlgsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLE1BQU0sQ0FDVCw0SEFBNEgsQ0FDN0gsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsbUhBQW1ILENBQ3BILENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULHVJQUF1SSxDQUN4SSxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCxnR0FBZ0csQ0FDakcsQ0FBQztRQUVGLElBQUksQ0FBQyxNQUFNLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7S0FnQlgsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLE1BQU0sQ0FDVCwySEFBMkgsQ0FDNUgsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1Qsd0xBQXdMLENBQ3pMLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULDBIQUEwSCxDQUMzSCxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFJO1FBQ1IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO1FBQ25FLElBQUksQ0FBQyxNQUFNLENBQUMsd0NBQXdDLENBQUMsQ0FBQztJQUN4RCxDQUFDO0NBQ0Y7QUFyRUQsb0ZBcUVDIn0=