import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { Modules, MedusaError } from '@medusajs/framework/utils';
import { BILLING_PROFILE_MODULE } from '../../../../../modules/billing-profile';
import type BillingProfileModuleService from '../../../../../modules/billing-profile/service';
import type { BillingSnapshot } from '../../../../../modules/billing-profile/types';
import { PostCartBilling } from '../../../billing-profiles/validators';

/**
 * Asocia datos de facturación a un cart (publishable-key, soporta guest).
 * Resuelve el snapshot server-side y lo persiste en cart.metadata (merge).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PostCartBilling.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const cartId = req.params.id as string;
  const cartService = req.scope.resolve(Modules.CART);

  const cart = await cartService
    .retrieveCart(cartId, { select: ['id', 'customer_id', 'metadata'] } as any)
    .catch(() => null);
  if (!cart) {
    res.status(404).json({ message: 'Carrito no encontrado.' });
    return;
  }

  const prevMeta = (cart.metadata ?? {}) as Record<string, unknown>;
  const body = parsed.data;

  let invoice_type: 'invoice_a' | 'final_consumer' = 'final_consumer';
  let billing_profile_id: string | null = null;
  let billing_snapshot: BillingSnapshot | null = null;

  if ('billing_profile_id' in body) {
    const service = req.scope.resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE);
    const profile = await service
      .retrieveBillingProfile(body.billing_profile_id)
      .catch(() => null);
    if (!profile) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Perfil de facturación no encontrado.');
    }
    // El perfil debe pertenecer al dueño del cart (evita usar perfil ajeno).
    if (!cart.customer_id || profile.customer_id !== cart.customer_id) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'El perfil no pertenece a este cliente.',
      );
    }
    invoice_type = 'invoice_a';
    billing_profile_id = profile.id;
    billing_snapshot = toSnapshot(profile);
  } else if (body.invoice_type === 'invoice_a') {
    invoice_type = 'invoice_a';
    billing_snapshot = toSnapshot(body.billing_data);
  } else {
    invoice_type = 'final_consumer';
  }

  await cartService.updateCarts(cartId, {
    metadata: {
      ...prevMeta,
      billing_profile_id,
      invoice_type,
      billing_snapshot,
    },
  });

  const eventBus = req.scope.resolve(Modules.EVENT_BUS);
  await eventBus.emit({
    name: 'cart.billing_snapshot_updated',
    data: { id: cartId, invoice_type },
  });

  res.json({ cart_id: cartId, invoice_type, billing_profile_id, billing_snapshot });
}

function toSnapshot(src: Record<string, unknown>): BillingSnapshot {
  // Verificación ARCA: el flag lo reporta el cliente (informativo, no garantía
  // fiscal); acá solo se exige que el CUIT consultado sea el del snapshot.
  const onlyDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');
  const arcaVerified =
    src.arca_verified === true &&
    onlyDigits(src.arca_lookup_cuit) === onlyDigits(src.document_number);
  return {
    arca_verified: arcaVerified,
    arca_verified_at: arcaVerified ? ((src.arca_verified_at as string) ?? null) : null,
    arca_lookup_cuit: arcaVerified ? ((src.arca_lookup_cuit as string) ?? null) : null,
    label: (src.label as string) ?? null,
    tax_condition: src.tax_condition as BillingSnapshot['tax_condition'],
    document_type: (src.document_type as BillingSnapshot['document_type']) ?? 'CUIT',
    document_number: src.document_number as string,
    legal_name: src.legal_name as string,
    billing_email: src.billing_email as string,
    billing_phone: (src.billing_phone as string) ?? null,
    address_line_1: src.address_line_1 as string,
    address_line_2: (src.address_line_2 as string) ?? null,
    city: src.city as string,
    province: src.province as string,
    postal_code: src.postal_code as string,
    country_code: (src.country_code as string) ?? 'ar',
  };
}
