import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { CORPORATE_MODULE } from '../../../../../modules/corporate';
import type CorporateModuleService from '../../../../../modules/corporate/service';
import type { CartRuleViolation } from '../../../../../modules/corporate/types';

type CartGraph = {
  id: string;
  total?: number;
  shipping_methods?: Array<{ shipping_option_id?: string }>;
  payment_collection?: {
    payment_sessions?: Array<{ provider_id?: string }>;
  } | null;
};

/**
 * Guard autoritativo: valida un carrito contra las reglas activas de la empresa
 * del cliente. Devuelve { ok, violations } — el storefront bloquea si !ok.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const cartId = req.query.cart_id ? String(req.query.cart_id) : '';
  if (!cartId) {
    res.status(400).json({ message: 'Falta cart_id.' });
    return;
  }

  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const membership = await service.getActiveMembershipByCustomer(customerId);
  if (!membership) {
    res.json({ ok: true, violations: [] });
    return;
  }

  const rules = await service.getActiveRules(membership.corporate_id);
  if (!rules.length) {
    res.json({ ok: true, violations: [] });
    return;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: carts } = (await query.graph({
    entity: 'cart',
    fields: [
      'id',
      'total',
      'shipping_methods.shipping_option_id',
      'payment_collection.payment_sessions.provider_id',
    ],
    filters: { id: cartId },
  })) as { data: CartGraph[] };
  const cart = carts[0];
  if (!cart) {
    res.json({ ok: true, violations: [] });
    return;
  }

  const total = Number(cart.total ?? 0);
  const shippingIds = (cart.shipping_methods ?? [])
    .map((m) => m.shipping_option_id)
    .filter(Boolean) as string[];
  const providerIds = (cart.payment_collection?.payment_sessions ?? [])
    .map((s) => s.provider_id)
    .filter(Boolean) as string[];

  const violations: CartRuleViolation[] = [];

  for (const rule of rules) {
    const cfg = (rule.config ?? {}) as Record<string, unknown>;
    if (rule.type === 'minimum_order_amount') {
      const min = Number(cfg.amount ?? 0);
      if (min > 0 && total < min) {
        violations.push({
          type: 'minimum_order_amount',
          message: `El monto mínimo de compra para tu empresa es ${min}.`,
        });
      }
    } else if (rule.type === 'maximum_order_amount') {
      const max = Number(cfg.amount ?? 0);
      if (max > 0 && total > max) {
        violations.push({
          type: 'maximum_order_amount',
          message: `El monto máximo de compra para tu empresa es ${max}.`,
        });
      }
    } else if (rule.type === 'allowed_shipping_methods') {
      const allowed = (cfg.ids as string[]) ?? [];
      if (allowed.length && shippingIds.some((id) => !allowed.includes(id))) {
        violations.push({
          type: 'allowed_shipping_methods',
          message: 'El método de envío seleccionado no está permitido para tu empresa.',
        });
      }
    } else if (rule.type === 'allowed_payment_methods') {
      const allowed = (cfg.ids as string[]) ?? [];
      if (allowed.length && providerIds.some((id) => !allowed.includes(id))) {
        violations.push({
          type: 'allowed_payment_methods',
          message: 'El método de pago seleccionado no está permitido para tu empresa.',
        });
      }
    }
  }

  res.json({ ok: violations.length === 0, violations });
}
