import { Migration } from '@mikro-orm/migrations';

export class Migration20260618130000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "andreani_box" (
        "id"           TEXT        NOT NULL,
        "name"         TEXT        NOT NULL,
        "height"       NUMERIC     NOT NULL,
        "width"        NUMERIC     NOT NULL,
        "deep"         NUMERIC     NOT NULL,
        "max_capacity" NUMERIC     NOT NULL DEFAULT 0,
        "is_active"    BOOLEAN     NOT NULL DEFAULT TRUE,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"   TIMESTAMPTZ,
        CONSTRAINT "andreani_box_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_andreani_box_is_active" ON "andreani_box" ("is_active");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_andreani_box_deleted_at" ON "andreani_box" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "andreani_box";`);
  }
}
