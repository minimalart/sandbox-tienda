"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260614000000 = void 0;
const migrations_1 = require("@mikro-orm/migrations");
class Migration20260614000000 extends migrations_1.Migration {
    async up() {
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "dynamic_group" (
        "id"                TEXT        NOT NULL,
        "name"              TEXT        NOT NULL,
        "handle"            TEXT        NOT NULL,
        "description"       TEXT,
        "customer_group_id" TEXT,
        "match"             TEXT        NOT NULL DEFAULT 'all',
        "conditions"        JSONB       NOT NULL,
        "update_mode"       TEXT        NOT NULL DEFAULT 'realtime',
        "is_active"         BOOLEAN     NOT NULL DEFAULT TRUE,
        "last_run_at"       TIMESTAMPTZ,
        "last_run_stats"    JSONB,
        "metadata"          JSONB,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "dynamic_group_pkey" PRIMARY KEY ("id")
      );
    `);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dynamic_group_handle" ON "dynamic_group" ("handle");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dynamic_group_is_active" ON "dynamic_group" ("is_active");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dynamic_group_customer_group_id" ON "dynamic_group" ("customer_group_id");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dynamic_group_deleted_at" ON "dynamic_group" ("deleted_at");`);
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "dynamic_group_membership_log" (
        "id"                TEXT        NOT NULL,
        "dynamic_group_id"  TEXT        NOT NULL,
        "customer_id"       TEXT        NOT NULL,
        "action"            TEXT        NOT NULL,
        "reason"            JSONB,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "dynamic_group_membership_log_pkey" PRIMARY KEY ("id")
      );
    `);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dgml_group" ON "dynamic_group_membership_log" ("dynamic_group_id");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dgml_customer" ON "dynamic_group_membership_log" ("customer_id");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dgml_deleted_at" ON "dynamic_group_membership_log" ("deleted_at");`);
    }
    async down() {
        this.addSql(`DROP TABLE IF EXISTS "dynamic_group_membership_log";`);
        this.addSql(`DROP TABLE IF EXISTS "dynamic_group";`);
    }
}
exports.Migration20260614000000 = Migration20260614000000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MTQwMDAwMDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9keW5hbWljLWdyb3Vwcy9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwNjE0MDAwMDAwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHNEQUFrRDtBQUVsRCxNQUFhLHVCQUF3QixTQUFRLHNCQUFTO0lBQ3BELEtBQUssQ0FBQyxFQUFFO1FBQ04sSUFBSSxDQUFDLE1BQU0sQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztLQW1CWCxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsTUFBTSxDQUNULHNGQUFzRixDQUN2RixDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCw0RkFBNEYsQ0FDN0YsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsNEdBQTRHLENBQzdHLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULDhGQUE4RixDQUMvRixDQUFDO1FBRUYsSUFBSSxDQUFDLE1BQU0sQ0FBQzs7Ozs7Ozs7Ozs7O0tBWVgsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLE1BQU0sQ0FDVCxxR0FBcUcsQ0FDdEcsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsbUdBQW1HLENBQ3BHLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULG9HQUFvRyxDQUNyRyxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFJO1FBQ1IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxzREFBc0QsQ0FBQyxDQUFDO1FBQ3BFLElBQUksQ0FBQyxNQUFNLENBQUMsdUNBQXVDLENBQUMsQ0FBQztJQUN2RCxDQUFDO0NBQ0Y7QUEvREQsMERBK0RDIn0=