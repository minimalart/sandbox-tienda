import { Migration } from '@mikro-orm/migrations';

export class Migration20260614140000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "media_asset" (
        "id"         TEXT        NOT NULL,
        "file_id"    TEXT,
        "url"        TEXT        NOT NULL,
        "filename"   TEXT        NOT NULL,
        "mime_type"  TEXT,
        "size"       INTEGER,
        "alt"        TEXT,
        "title"      TEXT,
        "source"     TEXT,
        "metadata"   JSONB,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_media_asset_filename" ON "media_asset" ("filename");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_media_asset_file_id" ON "media_asset" ("file_id");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_media_asset_url" ON "media_asset" ("url");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_media_asset_deleted_at" ON "media_asset" ("deleted_at");`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "media_asset";`);
  }
}
