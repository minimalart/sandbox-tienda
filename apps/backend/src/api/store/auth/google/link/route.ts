import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type {
  CustomerUpdatableFields,
  IAuthModuleService,
  ICustomerModuleService,
} from '@medusajs/framework/types';
import { selectLinkableCustomer } from './_select-customer';

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
 *
 * Invitados (`has_account: false`): si el email sólo matchea un customer
 * creado por un checkout guest, lo promovemos a cuenta real (`has_account:
 * true`) como parte del link — Google ya verificó ese email. Si matchean
 * AMBOS (invitado + cuenta real), se prioriza la cuenta real; ver
 * `_select-customer.ts`.
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

  // Puede haber más de un customer con este email: un invitado (checkout
  // guest) y, aparte, una cuenta real. `take` acota el caso patológico sin
  // asumir unicidad de email en la tabla.
  const candidates = await customerModule.listCustomers(
    { email },
    { take: 10, select: ['id', 'email', 'has_account'] },
  );

  const customer = selectLinkableCustomer(candidates);

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

  // Si el elegido es un invitado, Google ya verificó el email: promoverlo a
  // cuenta real ANTES de vincular la identity. Con este orden, si el proceso
  // se corta acá, el customer queda con `has_account: true` pero SIN forma de
  // loguearse todavía (nada roto); el orden inverso dejaría un invitado con
  // login habilitado y el flag sin corregir — exactamente el bug original.
  //
  // POR QUÉ EL CAST. `has_account` no está en `CustomerUpdatableFields`: Medusa
  // lo declara sólo en `CreateCustomerDTO`, o sea lo trata como un flag que se
  // fija al crear y no se toca después. La columna existe en el modelo y
  // `updateCustomers` la persiste igual; lo único que falta es el tipo.
  //
  // Y no hay camino de primera clase para esto: `createCustomerAccountWorkflow`
  // no sirve porque su step de validación TIRA si ya existe un invitado con ese
  // email — que es precisamente el caso que este endpoint resuelve. Promover un
  // invitado es un hueco de la API de Medusa v2, no un descuido de acá.
  //
  // El cast es angosto a propósito: sobre el objeto literal, no sobre el módulo
  // ni sobre el id, para que cualquier otro error de tipos en esta llamada siga
  // saliendo a la luz.
  if (customer.has_account === false) {
    await customerModule.updateCustomers(customer.id, {
      has_account: true,
    } as CustomerUpdatableFields);
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
