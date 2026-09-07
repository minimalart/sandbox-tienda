"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20250603000000 = void 0;
const migrations_1 = require("@mikro-orm/migrations");
class Migration20250603000000 extends migrations_1.Migration {
    async up() {
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "banner" (
        "id"            TEXT         NOT NULL,
        "internal_name" TEXT,
        "handle"        TEXT,
        "type"          TEXT,
        "device_type"   TEXT,
        "placement"     TEXT         NOT NULL,
        "status"        TEXT         NOT NULL DEFAULT 'draft',
        "priority"      INTEGER      NOT NULL DEFAULT 0,
        "content"       JSONB,
        "media"         JSONB,
        "cta"           JSONB,
        "metadata"      JSONB,
        "start_at"      TIMESTAMPTZ,
        "end_at"        TIMESTAMPTZ,
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMPTZ,
        CONSTRAINT "banner_pkey" PRIMARY KEY ("id")
      );
    `);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_banner_placement" ON "banner" ("placement");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_banner_status" ON "banner" ("status");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_banner_deleted_at" ON "banner" ("deleted_at");`);
    }
    async down() {
        this.addSql(`DROP TABLE IF EXISTS "banner";`);
    }
}
exports.Migration20250603000000 = Migration20250603000000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNTA2MDMwMDAwMDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9iYW5uZXIvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI1MDYwMzAwMDAwMC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxzREFBa0Q7QUFFbEQsTUFBYSx1QkFBd0IsU0FBUSxzQkFBUztJQUNwRCxLQUFLLENBQUMsRUFBRTtRQUNOLElBQUksQ0FBQyxNQUFNLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztLQXFCWCxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsTUFBTSxDQUFDLDhFQUE4RSxDQUFDLENBQUM7UUFDNUYsSUFBSSxDQUFDLE1BQU0sQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO1FBQ3RGLElBQUksQ0FBQyxNQUFNLENBQUMsZ0ZBQWdGLENBQUMsQ0FBQztJQUNoRyxDQUFDO0lBRUQsS0FBSyxDQUFDLElBQUk7UUFDUixJQUFJLENBQUMsTUFBTSxDQUFDLGdDQUFnQyxDQUFDLENBQUM7SUFDaEQsQ0FBQztDQUNGO0FBakNELDBEQWlDQyJ9