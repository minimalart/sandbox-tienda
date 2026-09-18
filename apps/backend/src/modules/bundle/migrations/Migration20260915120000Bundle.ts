import { Migration } from '@mikro-orm/migrations';

/**
 * Initial schema for the Bundle module.
 *
 * Naming: `<YYYYMMDDHHmmss><ModuleInPascal>` — enforced by
 * `src/modules/migration-names.test.ts` (see backend/CLAUDE.md).
 *
 * Idempotent DDL (`IF NOT EXISTS`) so re-runs during F1 iterations don't
 * error if part of the schema was applied manually in dev.
 */
export class Migration20260915120000Bundle extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "bundle" (
        "id" text PRIMARY KEY NOT NULL,
        "title" text NOT NULL,
        "handle" text NOT NULL,
        "description" text NULL,
        "thumbnail" text NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_bundle_handle_unique" ON "bundle" ("handle") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_bundle_status" ON "bundle" ("status", "deleted_at");`,
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "bundle_item" (
        "id" text PRIMARY KEY NOT NULL,
        "bundle_id" text NOT NULL,
        "product_id" text NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "position" integer NOT NULL DEFAULT 0,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "FK_bundle_item_bundle" FOREIGN KEY ("bundle_id") REFERENCES "bundle" ("id") ON DELETE CASCADE
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_bundle_item_bundle_position" ON "bundle_item" ("bundle_id", "position");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_bundle_item_product" ON "bundle_item" ("product_id");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "bundle_item" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "bundle" CASCADE;`);
  }
}
