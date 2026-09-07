import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Validación de grounding (anti-alucinación): guarda el veredicto del juez
 * `{ grounded, score, issues }` por corrida en `ai_agent_run.groundedness`.
 * Null cuando la validación está desactivada o no se llegó a evaluar.
 */
export class Migration20260627120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "ai_agent_run" add column if not exists "groundedness" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "ai_agent_run" drop column if exists "groundedness";`);
  }
}
