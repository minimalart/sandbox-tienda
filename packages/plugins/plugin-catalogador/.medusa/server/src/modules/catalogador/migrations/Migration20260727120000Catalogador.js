"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260727120000Catalogador = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * Costo de IA por ejecución y por producto (OpenRouter informa el costo real de
 * cada llamada en `usage.cost`). `ai_cost_usd` es columna propia para poder
 * ordenar/sumar por SQL; `ai_usage` guarda el desglose (texto vs imagen, tokens,
 * llamadas por modelo). Idempotente: `ADD COLUMN IF NOT EXISTS` sobre tablas
 * que pueden no existir todavía en entornos parcialmente migrados.
 */
class Migration20260727120000Catalogador extends migrations_1.Migration {
    async up() {
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
    async down() {
        this.addSql(`alter table if exists "cataloging_execution" drop column if exists "ai_cost_usd";`);
        this.addSql(`alter table if exists "cataloging_execution" drop column if exists "ai_usage";`);
        this.addSql(`alter table if exists "cataloging_execution_product" drop column if exists "ai_cost_usd";`);
        this.addSql(`alter table if exists "cataloging_execution_product" drop column if exists "ai_usage";`);
    }
}
exports.Migration20260727120000Catalogador = Migration20260727120000Catalogador;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MjcxMjAwMDBDYXRhbG9nYWRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA3MjcxMjAwMDBDYXRhbG9nYWRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7OztHQU1HO0FBQ0gsTUFBYSxrQ0FBbUMsU0FBUSxzQkFBUztJQUN0RCxLQUFLLENBQUMsRUFBRTtRQUNmLElBQUksQ0FBQyxNQUFNLENBQUM7Ozs7S0FJWCxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsTUFBTSxDQUFDOzs7O0tBSVgsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMsbUZBQW1GLENBQUMsQ0FBQztRQUNqRyxJQUFJLENBQUMsTUFBTSxDQUFDLGdGQUFnRixDQUFDLENBQUM7UUFDOUYsSUFBSSxDQUFDLE1BQU0sQ0FBQywyRkFBMkYsQ0FBQyxDQUFDO1FBQ3pHLElBQUksQ0FBQyxNQUFNLENBQUMsd0ZBQXdGLENBQUMsQ0FBQztJQUN4RyxDQUFDO0NBQ0Y7QUFwQkQsZ0ZBb0JDIn0=