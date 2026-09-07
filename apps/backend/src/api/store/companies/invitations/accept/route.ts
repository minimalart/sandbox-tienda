import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { acceptCompanyInvitationWorkflow } from '../../../../../workflows/accept-company-invitation';
import { PostAccept } from '../../validators';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = PostAccept.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const customerId = req.auth_context.actor_id;
  if (!customerId) {
    res.status(401).json({ message: 'No autenticado.' });
    return;
  }
  const { result } = await acceptCompanyInvitationWorkflow(req.scope).run({
    input: { token: parsed.data.token, customer_id: customerId },
  });
  res.status(201).json({ member: result });
}
