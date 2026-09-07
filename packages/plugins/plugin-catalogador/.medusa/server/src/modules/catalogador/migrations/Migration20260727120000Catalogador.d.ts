import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * Costo de IA por ejecución y por producto (OpenRouter informa el costo real de
 * cada llamada en `usage.cost`). `ai_cost_usd` es columna propia para poder
 * ordenar/sumar por SQL; `ai_usage` guarda el desglose (texto vs imagen, tokens,
 * llamadas por modelo). Idempotente: `ADD COLUMN IF NOT EXISTS` sobre tablas
 * que pueden no existir todavía en entornos parcialmente migrados.
 */
export declare class Migration20260727120000Catalogador extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
