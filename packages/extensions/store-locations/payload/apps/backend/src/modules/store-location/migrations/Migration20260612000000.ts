import { Migration } from '@mikro-orm/migrations';

export class Migration20260612000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "store_location" (
        "id"             TEXT         NOT NULL,
        "code"           TEXT,
        "store_type"     TEXT         NOT NULL DEFAULT 'point_of_sale',
        "name"           TEXT         NOT NULL,
        "province"       TEXT         NOT NULL,
        "city"           TEXT         NOT NULL,
        "street"         TEXT         NOT NULL,
        "phone"          TEXT,
        "whatsapp"       TEXT,
        "email"          TEXT,
        "website"        TEXT,
        "instagram"      TEXT,
        "facebook"       TEXT,
        "tiktok"         TEXT,
        "linkedin"       TEXT,
        "business_hours" JSONB,
        "images"         JSONB,
        "is_visible"     BOOLEAN      NOT NULL DEFAULT FALSE,
        "delivers_kits"  BOOLEAN      NOT NULL DEFAULT FALSE,
        "delivery_pin"   INTEGER,
        "lat"            TEXT,
        "lng"            TEXT,
        "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"     TIMESTAMPTZ,
        CONSTRAINT "store_location_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_store_location_is_visible_deleted_at" ON "store_location" ("is_visible", "deleted_at");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_store_location_deleted_at" ON "store_location" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "store_location";`);
  }
}
