import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Campaña comercial: tabla `ai_campaign` con el estado compartido + checklist del
 * wizard guiado (brief → entregables → productos → promoción → tono → ejecución →
 * preview → confirmación). Ver `models/campaign.ts`.
 */
export class Migration20260630200000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "ai_campaign" (
        "id" text not null,
        "thread_id" text null,
        "name" text not null,
        "status" text check ("status" in ('draft', 'intake', 'executing', 'preview', 'confirmed', 'cancelled')) not null default 'intake',
        "state" jsonb null,
        "checklist" jsonb null,
        "workflow_run_id" text null,
        "created_by" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_campaign_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_campaign_thread_id" ON "ai_campaign" ("thread_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_campaign_deleted_at" ON "ai_campaign" ("deleted_at") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ai_campaign" cascade;`);
  }
}
