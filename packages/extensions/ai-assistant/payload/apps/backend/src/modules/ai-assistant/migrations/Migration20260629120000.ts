import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Avatar/ícono del servidor MCP externo como foto subida al bucket: columna
 * `avatar_url` en `ai_mcp_server`. Sin ella se siguen usando las iniciales sobre
 * un color derivado de la key. Aditivo.
 */
export class Migration20260629120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE "ai_mcp_server" ADD COLUMN IF NOT EXISTS "avatar_url" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "ai_mcp_server" DROP COLUMN IF EXISTS "avatar_url";`);
  }
}
