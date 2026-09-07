import { Migration } from '@mikro-orm/migrations';

export class Migration20260618010000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "checkout_link" ADD COLUMN IF NOT EXISTS "customer_id" TEXT;`,
    );
  }

  async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE "checkout_link" DROP COLUMN IF EXISTS "customer_id";`,
    );
  }
}
