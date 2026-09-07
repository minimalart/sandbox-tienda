import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Servidores MCP externos: tabla `ai_mcp_server`. El Asistente IA puede registrar
 * MCPs de terceros (HTTP/SSE), descubrir sus tools y exponérselas a los agentes
 * junto a las del MCP interno. Credenciales cifradas en reposo (columnas `*_enc`).
 * Aditivo: no afecta el chat hasta que se registre y habilite un servidor.
 */
export class Migration20260628120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "ai_mcp_server" (
        "id" text not null,
        "key" text not null,
        "name" text not null,
        "url" text not null,
        "transport" text check ("transport" in ('http', 'sse')) not null default 'http',
        "auth_type" text check ("auth_type" in ('none', 'bearer', 'header', 'oauth')) not null default 'bearer',
        "auth_header_name" text null,
        "auth_secret_enc" text null,
        "oauth_client_id" text null,
        "oauth_client_secret_enc" text null,
        "oauth_scope" text null,
        "oauth_meta" jsonb null,
        "oauth_access_enc" text null,
        "oauth_refresh_enc" text null,
        "oauth_expires_at" timestamptz null,
        "oauth_pending" jsonb null,
        "enabled" boolean not null default true,
        "tools_cache" jsonb null,
        "tools_count" integer not null default 0,
        "health" text check ("health" in ('unknown', 'ok', 'error')) not null default 'unknown',
        "last_error" text null,
        "last_connected_at" timestamptz null,
        "last_discovered_at" timestamptz null,
        "created_by" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_mcp_server_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_mcp_server_key_unique" ON "ai_mcp_server" ("key") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_mcp_server_deleted_at" ON "ai_mcp_server" ("deleted_at") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ai_mcp_server" cascade;`);
  }
}
