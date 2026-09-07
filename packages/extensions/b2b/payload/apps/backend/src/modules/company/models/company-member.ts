import { model } from '@medusajs/framework/utils';

/** Relación usuario ↔ empresa con rol. v1: una membership activa por customer. */
export const CompanyMember = model
  .define('company_member', {
    id: model.id({ prefix: 'cmbr' }).primaryKey(),
    company_id: model.text(),
    customer_id: model.text(),
    role: model.text().default('buyer'),
    status: model.text().default('active'),
    invited_by: model.text().nullable(),
    joined_at: model.dateTime().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['company_id'] }, { on: ['customer_id'] }, { on: ['status'] }]);

export default CompanyMember;
