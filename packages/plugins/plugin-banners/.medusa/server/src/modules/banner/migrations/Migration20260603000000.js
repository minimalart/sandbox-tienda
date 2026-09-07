"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260603000000 = void 0;
const migrations_1 = require("@mikro-orm/migrations");
class Migration20260603000000 extends migrations_1.Migration {
    async up() {
        // Banner: rules column + composite indexes
        this.addSql(`ALTER TABLE IF EXISTS "banner" ADD COLUMN IF NOT EXISTS "rules" JSONB;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_banner_placement_status_priority" ON "banner" ("placement", "status", "priority");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_banner_start_at_end_at" ON "banner" ("start_at", "end_at");`);
        // Banner analytics
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "banner_analytics" (
        "id"                 TEXT         NOT NULL,
        "banner_id"          TEXT         NOT NULL,
        "impressions"        INTEGER      NOT NULL DEFAULT 0,
        "clicks"             INTEGER      NOT NULL DEFAULT 0,
        "last_impression_at" TIMESTAMPTZ,
        "last_click_at"      TIMESTAMPTZ,
        "created_at"         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMPTZ,
        CONSTRAINT "banner_analytics_pkey" PRIMARY KEY ("id")
      );
    `);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_banner_analytics_banner_id" ON "banner_analytics" ("banner_id");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_banner_analytics_deleted_at" ON "banner_analytics" ("deleted_at");`);
        // Banner audit
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "banner_audit" (
        "id"         TEXT         NOT NULL,
        "banner_id"  TEXT         NOT NULL,
        "action"     TEXT         NOT NULL,
        "user_id"    TEXT,
        "changes"    JSONB,
        "snapshot"   JSONB,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "banner_audit_pkey" PRIMARY KEY ("id")
      );
    `);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_banner_audit_banner_id" ON "banner_audit" ("banner_id");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_banner_audit_deleted_at" ON "banner_audit" ("deleted_at");`);
    }
    async down() {
        this.addSql(`DROP TABLE IF EXISTS "banner_audit";`);
        this.addSql(`DROP TABLE IF EXISTS "banner_analytics";`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_banner_start_at_end_at";`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_banner_placement_status_priority";`);
        this.addSql(`ALTER TABLE IF EXISTS "banner" DROP COLUMN IF EXISTS "rules";`);
    }
}
exports.Migration20260603000000 = Migration20260603000000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MDMwMDAwMDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9iYW5uZXIvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDYwMzAwMDAwMC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxzREFBa0Q7QUFFbEQsTUFBYSx1QkFBd0IsU0FBUSxzQkFBUztJQUNwRCxLQUFLLENBQUMsRUFBRTtRQUNOLDJDQUEyQztRQUMzQyxJQUFJLENBQUMsTUFBTSxDQUFDLHdFQUF3RSxDQUFDLENBQUM7UUFDdEYsSUFBSSxDQUFDLE1BQU0sQ0FDVCxvSEFBb0gsQ0FDckgsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsNkZBQTZGLENBQzlGLENBQUM7UUFFRixtQkFBbUI7UUFDbkIsSUFBSSxDQUFDLE1BQU0sQ0FBQzs7Ozs7Ozs7Ozs7OztLQWFYLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxNQUFNLENBQ1Qsa0dBQWtHLENBQ25HLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULG9HQUFvRyxDQUNyRyxDQUFDO1FBRUYsZUFBZTtRQUNmLElBQUksQ0FBQyxNQUFNLENBQUM7Ozs7Ozs7Ozs7Ozs7S0FhWCxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsTUFBTSxDQUNULDBGQUEwRixDQUMzRixDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCw0RkFBNEYsQ0FDN0YsQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsSUFBSTtRQUNSLElBQUksQ0FBQyxNQUFNLENBQUMsc0NBQXNDLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsTUFBTSxDQUFDLDBDQUEwQyxDQUFDLENBQUM7UUFDeEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO1FBQ2xFLElBQUksQ0FBQyxNQUFNLENBQUMsOERBQThELENBQUMsQ0FBQztRQUM1RSxJQUFJLENBQUMsTUFBTSxDQUFDLCtEQUErRCxDQUFDLENBQUM7SUFDL0UsQ0FBQztDQUNGO0FBL0RELDBEQStEQyJ9