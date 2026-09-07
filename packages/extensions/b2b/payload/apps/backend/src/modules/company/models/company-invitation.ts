import { model } from '@medusajs/framework/utils';

/** Invitación a unirse a una empresa mayorista (token de un solo uso, con vencimiento). */
export const CompanyInvitation = model
  .define('company_invitation', {
    id: model.id({ prefix: 'cminv' }).primaryKey(),
    company_id: model.text(),
    email: model.text(),
    role: model.text().default('buyer'),
    token: model.text(),
    invited_by: model.text().nullable(),
    status: model.text().default('pending'),
    expires_at: model.dateTime().nullable(),
    accepted_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ['token'] },
    { on: ['company_id'] },
    { on: ['email'] },
    { on: ['status'] },
  ]);

export default CompanyInvitation;
