"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260701090000 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260701090000 extends migrations_1.Migration {
    async up() {
        this.addSql(`create table if not exists "ga4_builtin_setting" ("id" text not null, "builtin_key" text not null, "is_active" boolean not null default true, "ga4_event_name" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ga4_builtin_setting_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ga4_builtin_setting_deleted_at" ON "ga4_builtin_setting" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_builtin_setting_key_unique" ON "ga4_builtin_setting" ("builtin_key") WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop table if exists "ga4_builtin_setting" cascade;`);
    }
}
exports.Migration20260701090000 = Migration20260701090000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MDEwOTAwMDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9nYTQvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDcwMTA5MDAwMC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckUsTUFBYSx1QkFBd0IsU0FBUSxzQkFBUztJQUMzQyxLQUFLLENBQUMsRUFBRTtRQUNmLElBQUksQ0FBQyxNQUFNLENBQ1QsdVdBQXVXLENBQ3hXLENBQUM7UUFFRixJQUFJLENBQUMsTUFBTSxDQUNULG1JQUFtSSxDQUNwSSxDQUFDO1FBRUYsSUFBSSxDQUFDLE1BQU0sQ0FDVCwySUFBMkksQ0FDNUksQ0FBQztJQUNKLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLHFEQUFxRCxDQUFDLENBQUM7SUFDckUsQ0FBQztDQUNGO0FBbEJELDBEQWtCQyJ9