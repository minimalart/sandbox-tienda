import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { CORPORATE_MODULE } from '../../../../modules/corporate';
import type CorporateModuleService from '../../../../modules/corporate/service';

/**
 * Público: datos mínimos de una invitación para la pantalla de aceptación
 * (`/corporate/invite/:token`). No expone info sensible.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const token = req.params.token as string;

  const matches = await service.listCorporateInvitations({ token });
  const invitation = matches[0];
  if (!invitation) {
    res.status(404).json({ message: 'Invitación no encontrada.' });
    return;
  }

  const expired =
    invitation.status === 'pending' &&
    invitation.expires_at != null &&
    new Date(invitation.expires_at) < new Date();
  const status = expired ? 'expired' : invitation.status;

  let corporateName: string | null = null;
  try {
    const corporate = await service.retrieveCorporate(invitation.corporate_id);
    corporateName = (corporate?.name as string) ?? null;
  } catch {
    /* noop */
  }

  res.json({
    invitation: {
      email: invitation.email,
      role: invitation.role,
      status,
      corporate_name: corporateName,
      valid: status === 'pending',
    },
  });
}
