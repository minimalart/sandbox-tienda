import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Costo de IA por ejecución y por producto (OpenRouter informa el costo real de
 * cada llamada en `usage.cost`). `ai_cost_usd` es columna propia para poder
 * ordenar/sumar por SQL; `ai_usage` guarda el desglose (texto vs imagen, tokens,
 * llamadas por modelo). Idempotente: `ADD COLUMN IF NOT EXISTS` sobre tablas
 * que pueden no existir todavía en entornos parcialmente migrados.
 */
export class Migration20260727120000Catalogador extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "cataloging_execution"
        add column if not exists "ai_cost_usd" real not null default 0,
        add column if not exists "ai_usage" jsonb null;
    `);
    this.addSql(`
      alter table if exists "cataloging_execution_product"
        add column if not exists "ai_cost_usd" real not null default 0,
        add column if not exists "ai_usage" jsonb null;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "cataloging_execution" drop column if exists "ai_cost_usd";`);
    this.addSql(`alter table if exists "cataloging_execution" drop column if exists "ai_usage";`);
    this.addSql(`alter table if exists "cataloging_execution_product" drop column if exists "ai_cost_usd";`);
    this.addSql(`alter table if exists "cataloging_execution_product" drop column if exists "ai_usage";`);
  }
}
