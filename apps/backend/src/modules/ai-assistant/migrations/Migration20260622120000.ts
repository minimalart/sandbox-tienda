import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260622120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "ai_tool_policy" ADD COLUMN IF NOT EXISTS "resource" text NOT NULL DEFAULT '';`
    );
    // La clave pasa a ser (tool, action, resource): el índice único viejo
    // (tool_name, action) impediría guardar dos resources del mismo tool+action.
    this.addSql(
      `DROP INDEX IF EXISTS "IDX_ai_tool_policy_tool_action_unique";`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_tool_policy_tool_action_resource_unique" ON "ai_tool_policy" ("tool_name", "action", "resource") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `DROP INDEX IF EXISTS "IDX_ai_tool_policy_tool_action_resource_unique";`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_tool_policy_tool_action_unique" ON "ai_tool_policy" ("tool_name", "action") WHERE deleted_at IS NULL;`
    );
    this.addSql(`ALTER TABLE "ai_tool_policy" DROP COLUMN IF EXISTS "resource";`);
  }
}
