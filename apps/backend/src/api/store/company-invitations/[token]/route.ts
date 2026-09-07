import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { COMPANY_MODULE } from '../../../../modules/company';
import type CompanyModuleService from '../../../../modules/company/service';

/** Público: datos mínimos de la invitación para la pantalla de aceptación. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const token = req.params.token as string;
  const matches = await service.listCompanyInvitations({ token });
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
  let companyName: string | null = null;
  try {
    const company = await service.retrieveCompany(invitation.company_id);
    companyName = (company?.name as string) ?? null;
  } catch {
    /* noop */
  }
  res.json({
    invitation: {
      email: invitation.email,
      role: invitation.role,
      status,
      company_name: companyName,
      valid: status === 'pending',
    },
  });
}
