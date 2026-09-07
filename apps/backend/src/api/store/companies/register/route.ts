import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { createCompanyWorkflow } from '../../../../workflows/create-company';
import { PostRegisterCompany } from '../validators';
import { getB2bSalesChannelId } from '../../../../modules/company/settings';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = PostRegisterCompany.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const customerId = req.auth_context.actor_id;
  if (!customerId) {
    res.status(401).json({ message: 'No autenticado.' });
    return;
  }
  const { result } = await createCompanyWorkflow(req.scope).run({
    input: {
      ...parsed.data,
      owner_customer_id: customerId,
      // El canal mayorista decide, vía `company/site-scope.ts`, a qué TIENDA
      // pertenece la empresa. `null` cuando no hay ninguno configurado, igual
      // que antes: la empresa se crea y se le asigna el canal después.
      sales_channel_id: getB2bSalesChannelId(),
    },
  });
  res.status(201).json({ company: result });
}
