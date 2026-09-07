"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260629171500 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
// NOTA: nombre con timestamp único (20260629171500). El nombre original
// (20260629120000) colisionaba con una migración de ai-assistant y MikroORM,
// que trackea por nombre global, la daba por aplicada y salteaba esta — por eso
// ga4_event_mapping/ga4_event_log nunca se creaban.
class Migration20260629171500 extends migrations_1.Migration {
    async up() {
        this.addSql(`create table if not exists "ga4_event_mapping" ("id" text not null, "medusa_event" text not null, "ga4_event_name" text not null, "is_active" boolean not null default true, "description" text null, "param_mappings" jsonb null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ga4_event_mapping_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ga4_event_mapping_deleted_at" ON "ga4_event_mapping" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_event_mapping_event_unique" ON "ga4_event_mapping" ("medusa_event", "ga4_event_name") WHERE deleted_at IS NULL;`);
        this.addSql(`create table if not exists "ga4_event_log" ("id" text not null, "medusa_event" text not null, "ga4_event_name" text not null, "client_id" text null, "payload" jsonb null, "status" text check ("status" in ('sent', 'failed', 'skipped')) not null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ga4_event_log_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ga4_event_log_deleted_at" ON "ga4_event_log" ("deleted_at") WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop table if exists "ga4_event_mapping" cascade;`);
        this.addSql(`drop table if exists "ga4_event_log" cascade;`);
    }
}
exports.Migration20260629171500 = Migration20260629171500;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MjkxNzE1MDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9nYTQvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDYyOTE3MTUwMC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckUsd0VBQXdFO0FBQ3hFLDZFQUE2RTtBQUM3RSxnRkFBZ0Y7QUFDaEYsb0RBQW9EO0FBQ3BELE1BQWEsdUJBQXdCLFNBQVEsc0JBQVM7SUFDM0MsS0FBSyxDQUFDLEVBQUU7UUFDZixJQUFJLENBQUMsTUFBTSxDQUNULHFiQUFxYixDQUN0YixDQUFDO1FBRUYsSUFBSSxDQUFDLE1BQU0sQ0FDVCwrSEFBK0gsQ0FDaEksQ0FBQztRQUVGLElBQUksQ0FBQyxNQUFNLENBQ1QsNEpBQTRKLENBQzdKLENBQUM7UUFFRixJQUFJLENBQUMsTUFBTSxDQUNULCtiQUErYixDQUNoYyxDQUFDO1FBRUYsSUFBSSxDQUFDLE1BQU0sQ0FDVCx1SEFBdUgsQ0FDeEgsQ0FBQztJQUNKLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLG1EQUFtRCxDQUFDLENBQUM7UUFFakUsSUFBSSxDQUFDLE1BQU0sQ0FBQywrQ0FBK0MsQ0FBQyxDQUFDO0lBQy9ELENBQUM7Q0FDRjtBQTVCRCwwREE0QkMifQ==