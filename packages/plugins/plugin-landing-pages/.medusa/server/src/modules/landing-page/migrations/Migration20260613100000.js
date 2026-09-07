"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260613100000 = void 0;
const migrations_1 = require("@mikro-orm/migrations");
class Migration20260613100000 extends migrations_1.Migration {
    async up() {
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "landing_page" (
        "id"               TEXT        NOT NULL,
        "title"            TEXT        NOT NULL,
        "slug"             TEXT        NOT NULL,
        "status"           TEXT        NOT NULL DEFAULT 'draft',
        "description"      TEXT,
        "seo"              JSONB,
        "puck_data"        JSONB,
        "template"         TEXT,
        "locale"           TEXT,
        "sales_channel_id" TEXT,
        "metadata"         JSONB,
        "published_at"     TIMESTAMPTZ,
        "created_by"       TEXT,
        "updated_by"       TEXT,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        CONSTRAINT "landing_page_pkey" PRIMARY KEY ("id")
      );
    `);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_landing_page_slug_unique" ON "landing_page" ("slug") WHERE "deleted_at" IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_landing_page_status" ON "landing_page" ("status");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_landing_page_locale" ON "landing_page" ("locale");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_landing_page_published_at" ON "landing_page" ("published_at");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_landing_page_status_slug" ON "landing_page" ("status", "slug");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_landing_page_deleted_at" ON "landing_page" ("deleted_at");`);
    }
    async down() {
        this.addSql(`DROP TABLE IF EXISTS "landing_page";`);
    }
}
exports.Migration20260613100000 = Migration20260613100000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MTMxMDAwMDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9sYW5kaW5nLXBhZ2UvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDYxMzEwMDAwMC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxzREFBa0Q7QUFFbEQsTUFBYSx1QkFBd0IsU0FBUSxzQkFBUztJQUNwRCxLQUFLLENBQUMsRUFBRTtRQUNOLElBQUksQ0FBQyxNQUFNLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztLQXFCWCxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsTUFBTSxDQUNULHlIQUF5SCxDQUMxSCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCxvRkFBb0YsQ0FDckYsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1Qsb0ZBQW9GLENBQ3JGLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULGdHQUFnRyxDQUNqRyxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCxpR0FBaUcsQ0FDbEcsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsNEZBQTRGLENBQzdGLENBQUM7SUFDSixDQUFDO0lBRUQsS0FBSyxDQUFDLElBQUk7UUFDUixJQUFJLENBQUMsTUFBTSxDQUFDLHNDQUFzQyxDQUFDLENBQUM7SUFDdEQsQ0FBQztDQUNGO0FBaERELDBEQWdEQyJ9