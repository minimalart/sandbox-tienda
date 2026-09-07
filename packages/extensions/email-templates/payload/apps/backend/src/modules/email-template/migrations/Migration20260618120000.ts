import { Migration } from '@mikro-orm/migrations';

/**
 * Adds the `design` column (Puck block document) to `email_template`.
 * The defensive DROP cleans up the `email_event` table from environments that
 * ran an earlier version of this migration before the events feature was
 * removed.
 */
export class Migration20260618120000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "email_template" ADD COLUMN IF NOT EXISTS "design" JSONB;`,
    );
    this.addSql(`DROP TABLE IF EXISTS "email_event";`);
  }

  async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE "email_template" DROP COLUMN IF EXISTS "design";`,
    );
  }
}
