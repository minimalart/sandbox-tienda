import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * Beneficios de Pago. Crea las tablas del módulo `payment_benefits`:
 * beneficios curados, catálogo crudo de medios de pago sincronizado, y log de
 * sincronización. Idempotente (IF NOT EXISTS) para poder re-correr sin romper.
 */
export declare class Migration20260706120000PaymentBenefits extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
