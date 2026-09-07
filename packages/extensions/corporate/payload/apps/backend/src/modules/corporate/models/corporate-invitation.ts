import { model } from '@medusajs/framework/utils';

/**
 * Invitación a unirse a una empresa. Token aleatorio de un solo uso con
 * vencimiento. El email se manda al crearla (degrada a link en admin si no hay
 * provider de email configurado).
 */
export const CorporateInvitation = model
  .define('corporate_invitation', {
    id: model.id({ prefix: 'cinv' }).primaryKey(),
    corporate_id: model.text(),
    email: model.text(),
    // rol a asignar al aceptar
    role: model.text().default('buyer'),
    token: model.text(),
    invited_by: model.text().nullable(),
    // 'pending' | 'accepted' | 'expired' | 'revoked'
    status: model.text().default('pending'),
    expires_at: model.dateTime().nullable(),
    accepted_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ['token'] },
    { on: ['corporate_id'] },
    { on: ['email'] },
    { on: ['status'] },
  ]);

export default CorporateInvitation;
