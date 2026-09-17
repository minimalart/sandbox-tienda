import { Migration } from '@mikro-orm/migrations';
export class Migration20260916120000MarketingReport extends Migration {
  async up(): Promise<void> {
    this.addSql(`CREATE TABLE IF NOT EXISTS marketing_report_cache (
      key text PRIMARY KEY, value jsonb NOT NULL, expires_at timestamptz NOT NULL
    )`);
  }
  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS marketing_report_cache');
  }
}
