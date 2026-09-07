import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Políticas runtime editables sin redeploy (paridad con Settings de
 * reorder-js): columnas nullable en `recurring_setting` — null = heredar del
 * fallback (fila global → env). Idempotente.
 */
export class Migration20260721190000RecurringOrder extends Migration {
  override async up(): Promise<void> {
    for (const column of [
      '"reminder_hours" INTEGER',
      '"expiration_hours" INTEGER',
      '"max_attempts" INTEGER',
      '"retry_hours" INTEGER',
      '"max_consecutive_failures" INTEGER',
      '"stock_policy" TEXT',
      '"price_change_policy" TEXT',
      '"price_change_threshold_pct" NUMERIC',
    ]) {
      this.addSql(
        `ALTER TABLE IF EXISTS "recurring_setting" ADD COLUMN IF NOT EXISTS ${column};`,
      );
    }
  }

  override async down(): Promise<void> {
    for (const column of [
      'reminder_hours',
      'expiration_hours',
      'max_attempts',
      'retry_hours',
      'max_consecutive_failures',
      'stock_policy',
      'price_change_policy',
      'price_change_threshold_pct',
    ]) {
      this.addSql(
        `ALTER TABLE IF EXISTS "recurring_setting" DROP COLUMN IF EXISTS "${column}";`,
      );
    }
  }
}
