import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
  AuthenticatedMedusaRequest,
} from '@medusajs/framework/http';
import type { Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

/**
 * Bypass del RBAC de framework 2.18 para actores `api-key`.
 *
 * En `@medusajs/framework` 2.18, `authenticate-middleware.js` hardcodea
 * `req.auth_context.app_metadata = {}` cuando el actor entra por
 * `Authorization: Basic sk_...` (secret API key). El comentario original en
 * ese archivo lo reconoce como deuda: "API keys have special handling for
 * now. We could also generalize API keys to carry the actor type with them."
 *
 * Con `featureFlags.rbac: true` prendido en `medusa-config.ts`,
 * `check-permissions.js` lee `authContext.app_metadata.roles` y tira
 * `FORBIDDEN` si viene vacío. Consecuencia: TODA ruta `/admin/*` con
 * `policies` declaradas devuelve 403 a la secret key del ai-assistant, aun
 * cuando la key está activa y validada por `authenticate`.
 *
 * Este middleware inyecta un role id en `app_metadata.roles` sólo para actor
 * `api-key`. Por default apunta a `role_super_admin` (que ya trae la policy
 * wildcard `*:*` en la DB); configurable por env var
 * `ASSISTANT_API_KEY_ROLE_ID` para desacoplar código y datos.
 *
 * Solución definitiva: medusajs/medusa#15620 (OPEN) incorpora
 * `rbac_role_assignment` con `reference: "api_key"`. Cuando llegue en un
 * bump de Medusa, retirar este bypass y modelar el rol del asistente por el
 * mecanismo oficial. También referenciar medusajs/medusa#16339 al respecto
 * de policies archivadas silenciosamente en el sync — descartado como causa
 * activa para nosotros tras auditar la DB (0 policies con `deleted_at`, 0
 * grants huérfanos).
 */
const DEFAULT_API_KEY_ROLE_ID = 'role_super_admin';

const injectApiKeyRoles = (
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): void => {
  const authReq = req as AuthenticatedMedusaRequest;

  // Guarda defensiva con optional chaining: si el middleware corriera antes
  // de que `authenticate` arme el auth_context, quedamos en no-op sin romper.
  if (authReq.auth_context?.actor_type !== 'api-key') {
    return next();
  }

  const roleId =
    process.env.ASSISTANT_API_KEY_ROLE_ID?.trim() || DEFAULT_API_KEY_ROLE_ID;

  // No pisar app_metadata completo por si el framework llega a poblarlo con
  // otras claves en el futuro; sólo setear roles.
  (authReq.auth_context.app_metadata ??= {}).roles = [roleId];

  // Log opt-in para validar el fix en local sin ensuciar producción. Con
  // ASSISTANT_API_KEY_RBAC_LOG=true tirás una línea por request api-key.
  if (process.env.ASSISTANT_API_KEY_RBAC_LOG === 'true') {
    try {
      const logger = authReq.scope.resolve<Logger>(
        ContainerRegistrationKeys.LOGGER
      );
      logger.info(
        `[api-key-rbac] role=${roleId} actor=${authReq.auth_context.actor_id} ${req.method} ${req.path}`
      );
    } catch {
      // Container aún no disponible: no bloquear la request por un log.
    }
  }

  return next();
};

export const apiKeyRbacMiddlewares: MiddlewareRoute[] = [
  { matcher: '/admin/*', middlewares: [injectApiKeyRoles] },
];
