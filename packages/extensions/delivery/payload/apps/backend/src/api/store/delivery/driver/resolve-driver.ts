import type { AuthenticatedMedusaRequest } from '@medusajs/framework/http';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';

type UnknownRecord = Record<string, unknown>;

/**
 * Resuelve el Driver activo asociado al admin User autenticado.
 *
 * El driver se autentica en la PWA con su admin User de Medusa
 * (authenticate('user', ...)). `req.auth_context.actor_id` es el user_id. La
 * relación driver↔user vive en el link driver-user; acá la resolvemos por la
 * columna denormalizada `user_id` del Driver (lookup directo, sin graph extra).
 *
 * Lanza:
 *  - UNAUTHORIZED si no hay actor.
 *  - NOT_FOUND si el user no tiene un Driver asociado (o está inactivo).
 */
export async function resolveDriverFromAuth(
  req: AuthenticatedMedusaRequest,
): Promise<UnknownRecord> {
  const userId = req.auth_context?.actor_id;
  if (!userId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      'No autenticado.',
    );
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: drivers } = await query.graph({
    entity: 'driver',
    fields: [
      'id',
      'name',
      'status',
      'active',
      'store_location_id',
      'user_id',
    ],
    filters: { user_id: userId, active: true },
  });

  const driver = drivers?.[0] as UnknownRecord | undefined;
  if (!driver) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      'No hay un repartidor activo asociado a tu usuario.',
    );
  }

  return driver;
}
