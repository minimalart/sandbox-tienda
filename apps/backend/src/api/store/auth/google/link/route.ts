import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type {
  IAuthModuleService,
  ICustomerModuleService,
} from '@medusajs/framework/types';

const GOOGLE_PROVIDER = 'google';

/**
 * POST /store/auth/google/link
 *
 * Vincula la auth identity de Google (recién emitida, sin actor_id) a un customer
 * EXISTENTE que tenga el mismo email — el caso de quien se registró antes con
 * email/contraseña y ahora entra con Google. Sin esto, el storefront intentaba
 * crear un customer nuevo y Medusa lo rechazaba con "Customer with this email
 * already has an account".
 *
 * Devuelve { linked: true } si quedó vinculado (o ya lo estaba), o 404 si no hay
 * customer con ese email (el storefront entonces crea uno: usuario nuevo).
 *
 * Seguridad: solo vincula por match EXACTO del email verificado por Google
 * (el provider solo persiste la identity si email_verified === true). El cliente
 * nunca envía un customer_id.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const authIdentityId = req.auth_context?.auth_identity_id;
  const actorId = req.auth_context?.actor_id;

  // Token ya ligado a un customer → nada que hacer.
  if (actorId) {
    res.status(200).json({ linked: true, customer_id: actorId });
    return;
  }

  if (!authIdentityId) {
    res.status(401).json({ linked: false, reason: 'no_auth_identity' });
    return;
  }

  const authModule = req.scope.resolve<IAuthModuleService>(Modules.AUTH);
  const customerModule = req.scope.resolve<ICustomerModuleService>(
    Modules.CUSTOMER,
  );

  const authIdentity = await authModule.retrieveAuthIdentity(authIdentityId, {
    relations: ['provider_identities'],
  });

  // Ya vinculada (cubre una carrera donde el token quedó viejo).
  const existingCustomerId = authIdentity.app_metadata?.customer_id as
    | string
    | undefined;
  if (existingCustomerId) {
    res.status(200).json({ linked: true, customer_id: existingCustomerId });
    return;
  }

  // El email va en el provider identity de google (`user_metadata.email`); el
  // `entity_id` es el `sub`, no el email. Google solo persiste la identity con
  // email verificado, así que su presencia implica verificado en origen.
  const google = authIdentity.provider_identities?.find(
    (p) => p.provider === GOOGLE_PROVIDER,
  );
  const email = (google?.user_metadata?.email as string | undefined)
    ?.trim()
    .toLowerCase();

  if (!google || !email) {
    res.status(404).json({ linked: false, reason: 'no_verified_email' });
    return;
  }

  const [customer] = await customerModule.listCustomers(
    { email },
    { take: 1, select: ['id', 'email'] },
  );

  if (!customer) {
    // Usuario nuevo → el storefront crea el customer con su flujo normal.
    res.status(404).json({ linked: false, reason: 'no_existing_customer' });
    return;
  }

  // Match exacto, normalizado (defensivo).
  if (customer.email?.trim().toLowerCase() !== email) {
    res.status(404).json({ linked: false, reason: 'email_mismatch' });
    return;
  }

  // Vincular: setear customer_id en el app_metadata de la auth identity.
  await authModule.updateAuthIdentities({
    id: authIdentityId,
    app_metadata: {
      ...(authIdentity.app_metadata ?? {}),
      customer_id: customer.id,
    },
  });

  res.status(200).json({ linked: true, customer_id: customer.id });
}
