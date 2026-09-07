import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Avatar del agente como foto subida al bucket: columna `avatar_url` en `ai_agent`.
 * Reemplaza al emoji (`icon`, que queda como legado sin uso). Aditivo.
 */
export class Migration20260628140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE "ai_agent" ADD COLUMN IF NOT EXISTS "avatar_url" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "ai_agent" DROP COLUMN IF EXISTS "avatar_url";`);
  }
}
