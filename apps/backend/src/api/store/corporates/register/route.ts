import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { createCorporateWorkflow } from '../../../../workflows/create-corporate';
import { PostRegisterCorporate } from '../validators';
import { getCorporateSettings } from '../../../../modules/corporate/settings';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = PostRegisterCorporate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }
  const customerId = req.auth_context.actor_id;
  if (!customerId) {
    res.status(401).json({ message: 'No autenticado.' });
    return;
  }

  // Se lee POR REQUEST y no en un `const` de módulo, que es como estaba: la card
  // del admin cambia el modo en caliente, y una constante de import lo congelaría
  // hasta el próximo reinicio.
  const { activationMode } = getCorporateSettings();

  const { result } = await createCorporateWorkflow(req.scope).run({
    input: {
      ...parsed.data,
      owner_customer_id: customerId,
      activation_mode: activationMode,
    },
  });

  res.status(201).json({ corporate: result });
}
