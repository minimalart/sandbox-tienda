import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';
import { COMPANY_MODULE } from '../../../../modules/company';
import type CompanyModuleService from '../../../../modules/company/service';
import { resolveB2BLines } from '../resolve-lines';

const Body = z.object({ order_id: z.string().min(1) });

type OrderRow = {
  id: string;
  metadata: Record<string, unknown> | null;
  items?: Array<{ variant_id?: string | null; quantity?: number }>;
};

/** Volver a pedir: toma los ítems de una orden previa de la empresa y los resuelve para un carrito nuevo. */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const customerId = req.auth_context.actor_id;
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const membership = await companyService.getMembershipByCustomer(customerId);
  if (!membership) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'No pertenecés a ninguna empresa.');
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: ['id', 'metadata', 'items.variant_id', 'items.quantity'],
    filters: { id: parsed.data.order_id },
  })) as { data: OrderRow[] };
  const order = orders[0];
  if (!order || order.metadata?.company_id !== membership.company_id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Pedido no encontrado para tu empresa.');
  }

  const lines = (order.items ?? [])
    .filter((i) => i.variant_id)
    .map((i) => ({ variant_id: i.variant_id as string, quantity: Number(i.quantity) || 1 }));
  if (!lines.length) {
    res.json({ resolved: [], out_of_stock: [], not_found: [] });
    return;
  }
  const result = await resolveB2BLines(req.scope, customerId, lines);
  res.json(result);
}
