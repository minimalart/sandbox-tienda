import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * Esquema inicial del módulo Catalogador (PRD §24). Crea las 6 tablas de
 * ejecuciones/propuestas/snapshots/actividad. Idempotente (`IF NOT EXISTS`) para
 * poder correrse en entornos parcialmente migrados (ver docs/recipes/
 * migraciones-modulos-custom.md). Nombre `Migration<ts>Catalogador` según la
 * convención exigida por migration-names.test.ts.
 */
export declare class Migration20260714150000Catalogador extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
