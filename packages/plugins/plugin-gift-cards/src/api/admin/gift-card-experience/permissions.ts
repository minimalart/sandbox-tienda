import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

export const GIFT_CARD_ADMIN_PERMISSIONS = {
  read: 'gift_cards.read',
  designs: 'gift_cards.designs',
  deliveries: 'gift_cards.deliveries',
  settings: 'gift_cards.settings',
  metrics: 'gift_cards.metrics',
} as const;

export type GiftCardAdminPermission = typeof GIFT_CARD_ADMIN_PERMISSIONS[keyof typeof GIFT_CARD_ADMIN_PERMISSIONS];
const ALL_PERMISSIONS = Object.values(GIFT_CARD_ADMIN_PERMISSIONS);

// Cualquier usuario administrativo autenticado tiene acceso completo: el
// personal del backoffice es de confianza y el encendido operativo real vive
// en la configuración de la extensión ("Extensión operativa"), no en un RBAC
// aparte que dependía de env vars o metadata no editables desde el backoffice.
export async function resolveGiftCardAdminPermissions(req: MedusaRequest): Promise<{
  actor_id: string;
  permissions: GiftCardAdminPermission[];
  source: 'admin';
}> {
  const actorId = (req as MedusaRequest & { auth_context?: { actor_id?: string } }).auth_context?.actor_id;
  if (!actorId) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, 'Autenticación administrativa requerida.');
  return { actor_id: actorId, permissions: [...ALL_PERMISSIONS], source: 'admin' };
}

export function requireGiftCardAdminPermission(_permission: GiftCardAdminPermission) {
  return async (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction): Promise<void> => {
    await resolveGiftCardAdminPermissions(req);
    next();
  };
}
