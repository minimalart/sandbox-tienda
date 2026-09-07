"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260719183000GiftCardOperations = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260719183000GiftCardOperations extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE IF EXISTS "gift_card_settings" ADD COLUMN IF NOT EXISTS "balance_reminder_days" INTEGER DEFAULT 30;`);
        this.addSql(`ALTER TABLE IF EXISTS "gift_card_settings" ADD COLUMN IF NOT EXISTS "expiring_notice_days" INTEGER DEFAULT 7;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_lifecycle_notification" ON "gift_card_event" ("delivery_id", "event") WHERE "deleted_at" IS NULL AND "delivery_id" IS NOT NULL AND "event" IN ('balance_reminder', 'expiring_notice');`);
    }
    async down() {
        this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_lifecycle_notification";`);
        this.addSql(`ALTER TABLE IF EXISTS "gift_card_settings" DROP COLUMN IF EXISTS "expiring_notice_days";`);
        this.addSql(`ALTER TABLE IF EXISTS "gift_card_settings" DROP COLUMN IF EXISTS "balance_reminder_days";`);
    }
}
exports.Migration20260719183000GiftCardOperations = Migration20260719183000GiftCardOperations;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MTkxODMwMDBHaWZ0Q2FyZE9wZXJhdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9naWZ0LWNhcmQtZXhwZXJpZW5jZS9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwNzE5MTgzMDAwR2lmdENhcmRPcGVyYXRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlFQUFxRTtBQUVyRSxNQUFhLHlDQUEwQyxTQUFRLHNCQUFTO0lBQzdELEtBQUssQ0FBQyxFQUFFO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxpSEFBaUgsQ0FBQyxDQUFDO1FBQy9ILElBQUksQ0FBQyxNQUFNLENBQUMsK0dBQStHLENBQUMsQ0FBQztRQUM3SCxJQUFJLENBQUMsTUFBTSxDQUFDLHlPQUF5TyxDQUFDLENBQUM7SUFDelAsQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMsOERBQThELENBQUMsQ0FBQztRQUM1RSxJQUFJLENBQUMsTUFBTSxDQUFDLDBGQUEwRixDQUFDLENBQUM7UUFDeEcsSUFBSSxDQUFDLE1BQU0sQ0FBQywyRkFBMkYsQ0FBQyxDQUFDO0lBQzNHLENBQUM7Q0FDRjtBQVpELDhGQVlDIn0=