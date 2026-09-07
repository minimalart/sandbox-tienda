import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260719183000GiftCardOperations extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "gift_card_settings" ADD COLUMN IF NOT EXISTS "balance_reminder_days" INTEGER DEFAULT 30;`);
    this.addSql(`ALTER TABLE IF EXISTS "gift_card_settings" ADD COLUMN IF NOT EXISTS "expiring_notice_days" INTEGER DEFAULT 7;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_lifecycle_notification" ON "gift_card_event" ("delivery_id", "event") WHERE "deleted_at" IS NULL AND "delivery_id" IS NOT NULL AND "event" IN ('balance_reminder', 'expiring_notice');`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_lifecycle_notification";`);
    this.addSql(`ALTER TABLE IF EXISTS "gift_card_settings" DROP COLUMN IF EXISTS "expiring_notice_days";`);
    this.addSql(`ALTER TABLE IF EXISTS "gift_card_settings" DROP COLUMN IF EXISTS "balance_reminder_days";`);
  }
}
