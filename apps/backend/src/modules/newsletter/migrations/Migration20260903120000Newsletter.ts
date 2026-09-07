import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `newsletter_subscription` — tabla inicial de la extensión Newsletter.
 *
 * El índice de unicidad es PARCIAL (`WHERE deleted_at IS NULL`) a propósito:
 * los modelos de Medusa borran en lógico, y un único total dejaría que una fila
 * borrada bloqueara para siempre el alta de ese mismo mail en esa tienda.
 *
 * `site_id` va como columna común y no como FK: el registro de tiendas es una
 * extensión opcional (`multistore`), así que una FK dura haría que esta tabla no
 * pueda crearse en un proyecto que no la instaló.
 */
export class Migration20260903120000Newsletter extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "newsletter_subscription" (
        "id"                TEXT        NOT NULL,
        "email"             TEXT        NOT NULL,
        "site_id"           TEXT,
        "source"            TEXT,
        "sync_status"       TEXT        NOT NULL DEFAULT 'pending',
        "sync_error"        TEXT,
        "synced_at"         TIMESTAMPTZ,
        "provider_list_id"  TEXT,
        "ip"                TEXT,
        "user_agent"        TEXT,
        "metadata"          JSONB,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "newsletter_subscription_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_newsletter_subscription_email_site_unique" ` +
        `ON "newsletter_subscription" ("email", "site_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_newsletter_subscription_sync_status" ` +
        `ON "newsletter_subscription" ("sync_status");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_newsletter_subscription_site" ` +
        `ON "newsletter_subscription" ("site_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_newsletter_subscription_deleted_at" ` +
        `ON "newsletter_subscription" ("deleted_at");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "newsletter_subscription";`);
  }
}
