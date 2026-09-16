import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260913090000AiAssistant extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table "ai_mcp_server" add column if not exists "trust_read_only_hints" boolean not null default false;'
    );
  }

  override async down(): Promise<void> {
    this.addSql('alter table "ai_mcp_server" drop column if exists "trust_read_only_hints";');
  }
}
