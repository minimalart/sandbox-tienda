"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260604135249 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260604135249 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "points_account" drop constraint if exists "points_account_customer_id_unique";`);
        this.addSql(`create table if not exists "points_account" ("id" text not null, "customer_id" text not null, "balance" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "points_account_pkey" primary key ("id"));`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_points_account_customer_id_unique" ON "points_account" ("customer_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_points_account_deleted_at" ON "points_account" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`create table if not exists "points_transaction" ("id" text not null, "amount" integer not null, "type" text check ("type" in ('earn', 'redeem', 'adjust')) not null, "reference" text null, "reference_id" text null, "account_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "points_transaction_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_points_transaction_account_id" ON "points_transaction" ("account_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_points_transaction_deleted_at" ON "points_transaction" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`alter table if exists "points_transaction" add constraint "points_transaction_account_id_foreign" foreign key ("account_id") references "points_account" ("id") on update cascade;`);
    }
    async down() {
        this.addSql(`alter table if exists "points_transaction" drop constraint if exists "points_transaction_account_id_foreign";`);
        this.addSql(`drop table if exists "points_account" cascade;`);
        this.addSql(`drop table if exists "points_transaction" cascade;`);
    }
}
exports.Migration20260604135249 = Migration20260604135249;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MDQxMzUyNDkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9wb2ludHMvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDYwNDEzNTI0OS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckUsTUFBYSx1QkFBd0IsU0FBUSxzQkFBUztJQUUzQyxLQUFLLENBQUMsRUFBRTtRQUNmLElBQUksQ0FBQyxNQUFNLENBQUMsdUdBQXVHLENBQUMsQ0FBQztRQUNySCxJQUFJLENBQUMsTUFBTSxDQUFDLDRUQUE0VCxDQUFDLENBQUM7UUFDMVUsSUFBSSxDQUFDLE1BQU0sQ0FBQyx5SUFBeUksQ0FBQyxDQUFDO1FBQ3ZKLElBQUksQ0FBQyxNQUFNLENBQUMseUhBQXlILENBQUMsQ0FBQztRQUV2SSxJQUFJLENBQUMsTUFBTSxDQUFDLDhhQUE4YSxDQUFDLENBQUM7UUFDNWIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxpSUFBaUksQ0FBQyxDQUFDO1FBQy9JLElBQUksQ0FBQyxNQUFNLENBQUMsaUlBQWlJLENBQUMsQ0FBQztRQUUvSSxJQUFJLENBQUMsTUFBTSxDQUFDLG9MQUFvTCxDQUFDLENBQUM7SUFDcE0sQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMsK0dBQStHLENBQUMsQ0FBQztRQUU3SCxJQUFJLENBQUMsTUFBTSxDQUFDLGdEQUFnRCxDQUFDLENBQUM7UUFFOUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7Q0FFRjtBQXZCRCwwREF1QkMifQ==