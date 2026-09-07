import { Migration } from '@mikro-orm/migrations';

/**
 * Initial contact_submission table. Name preserved from the original extension
 * migration so MikroORM skips it in stores where the extension was previously
 * installed (mikro_orm_migrations tracks by class name).
 */
export class Migration20260613200000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "contact_submission" (
        "id"          TEXT        NOT NULL,
        "first_name"  TEXT        NOT NULL,
        "last_name"   TEXT        NOT NULL,
        "email"       TEXT        NOT NULL,
        "phone"       TEXT,
        "message"     TEXT        NOT NULL,
        "status"      TEXT        NOT NULL DEFAULT 'new',
        "source"      TEXT,
        "ip"          TEXT,
        "user_agent"  TEXT,
        "metadata"    JSONB,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMPTZ,
        CONSTRAINT "contact_submission_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_contact_submission_status" ON "contact_submission" ("status");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_contact_submission_email" ON "contact_submission" ("email");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_contact_submission_deleted_at" ON "contact_submission" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "contact_submission";`);
  }
}
