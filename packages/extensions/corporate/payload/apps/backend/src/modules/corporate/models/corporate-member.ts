import { model } from '@medusajs/framework/utils';

/**
 * Relación Customer ↔ Corporate con rol. Regla de negocio v1: un customer tiene
 * a lo sumo UNA membership activa (para resolver reglas en checkout sin ambigüedad).
 */
export const CorporateMember = model
  .define('corporate_member', {
    id: model.id({ prefix: 'cmem' }).primaryKey(),
    corporate_id: model.text(),
    customer_id: model.text(),
    // 'owner' | 'admin' | 'buyer' | 'viewer'
    role: model.text().default('buyer'),
    // 'invited' | 'active' | 'disabled'
    status: model.text().default('active'),
    invited_by: model.text().nullable(),
    joined_at: model.dateTime().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['corporate_id'] }, { on: ['customer_id'] }, { on: ['status'] }]);

export default CorporateMember;
