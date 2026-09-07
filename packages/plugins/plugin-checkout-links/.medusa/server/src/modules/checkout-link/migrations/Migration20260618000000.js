"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260618000000 = void 0;
const migrations_1 = require("@mikro-orm/migrations");
class Migration20260618000000 extends migrations_1.Migration {
    async up() {
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "checkout_link" (
        "id"               TEXT         NOT NULL,
        "token"            TEXT         NOT NULL,
        "internal_name"    TEXT,
        "items"            JSONB        NOT NULL,
        "country_code"     TEXT         NOT NULL,
        "region_id"        TEXT,
        "sales_channel_id" TEXT,
        "email"            TEXT,
        "shipping_address" JSONB,
        "promo_codes"      JSONB,
        "status"           TEXT         NOT NULL DEFAULT 'active',
        "single_use"       BOOLEAN      NOT NULL DEFAULT FALSE,
        "used_count"       INTEGER      NOT NULL DEFAULT 0,
        "expires_at"       TIMESTAMPTZ,
        "created_by"       TEXT,
        "metadata"         JSONB,
        "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        CONSTRAINT "checkout_link_pkey" PRIMARY KEY ("id")
      );
    `);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_checkout_link_token_unique" ON "checkout_link" ("token") WHERE "deleted_at" IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_checkout_link_token" ON "checkout_link" ("token");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_checkout_link_status" ON "checkout_link" ("status");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_checkout_link_deleted_at" ON "checkout_link" ("deleted_at");`);
    }
    async down() {
        this.addSql(`DROP TABLE IF EXISTS "checkout_link";`);
    }
}
exports.Migration20260618000000 = Migration20260618000000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MTgwMDAwMDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9jaGVja291dC1saW5rL21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA2MTgwMDAwMDAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsc0RBQWtEO0FBRWxELE1BQWEsdUJBQXdCLFNBQVEsc0JBQVM7SUFDcEQsS0FBSyxDQUFDLEVBQUU7UUFDTixJQUFJLENBQUMsTUFBTSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztLQXVCWCxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsTUFBTSxDQUNULDZIQUE2SCxDQUM5SCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCxvRkFBb0YsQ0FDckYsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1Qsc0ZBQXNGLENBQ3ZGLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULDhGQUE4RixDQUMvRixDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFJO1FBQ1IsSUFBSSxDQUFDLE1BQU0sQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO0lBQ3ZELENBQUM7Q0FDRjtBQTVDRCwwREE0Q0MifQ==