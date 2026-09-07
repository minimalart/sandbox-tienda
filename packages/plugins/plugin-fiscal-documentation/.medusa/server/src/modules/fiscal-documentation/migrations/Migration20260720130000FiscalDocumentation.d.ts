import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * Documentación Fiscal — tabla de constancias fiscales versionadas, compartida
 * por las extensiones corporate y company (owner polimórfico).
 * Idempotente (IF NOT EXISTS) para poder re-correr sin romper.
 */
export declare class Migration20260720130000FiscalDocumentation extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
