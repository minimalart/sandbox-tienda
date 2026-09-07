"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260614140000 = void 0;
const migrations_1 = require("@mikro-orm/migrations");
class Migration20260614140000 extends migrations_1.Migration {
    async up() {
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
    async down() {
        this.addSql(`DROP TABLE IF EXISTS "media_asset";`);
    }
}
exports.Migration20260614140000 = Migration20260614140000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MTQxNDAwMDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9tZWRpYS1saWJyYXJ5L21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA2MTQxNDAwMDAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsc0RBQWtEO0FBRWxELE1BQWEsdUJBQXdCLFNBQVEsc0JBQVM7SUFDcEQsS0FBSyxDQUFDLEVBQUU7UUFDTixJQUFJLENBQUMsTUFBTSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7OztLQWlCWCxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsTUFBTSxDQUFDLHNGQUFzRixDQUFDLENBQUM7UUFDcEcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxvRkFBb0YsQ0FBQyxDQUFDO1FBQ2xHLElBQUksQ0FBQyxNQUFNLENBQUMsNEVBQTRFLENBQUMsQ0FBQztRQUMxRixJQUFJLENBQUMsTUFBTSxDQUFDLDBGQUEwRixDQUFDLENBQUM7SUFDMUcsQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFJO1FBQ1IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO0lBQ3JELENBQUM7Q0FDRjtBQTdCRCwwREE2QkMifQ==